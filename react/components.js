// The overall UI of the page
var Studio = React.createClass({
    getInitialState: function() {
        return {
            mode: "edit",
            text: ""
        }
    },
    run_tests: function() {
        // Runs the unit tests
        this.props.Tests.run_tests(this.props.MIPS);
        alert("Tests complete! Check web console for results.");
    },
    toggle_mode: function() {
        // Switches between "edit" and "runtime"
        var state = this.state;
        if(state.mode === "edit") {
            state.mode = "run";
        } else {
            state.mode = "edit";
        }
        this.setState(state);
    },
    update_text: function(text) {
        // Updates the text of the currently open program
        var state = this.state;
        state.text = text;
        this.setState(state);
    },
    render: function() {
        // Set the display mode
        var display_mode = "Edit";
        if(this.state.mode === "run") {
            display_mode = "Run";
        }

        // Set the correct contents for various parts of the UI
        var contents = null;
        if(this.state.mode === "edit") {
            contents = (<Editor change={this.update_text} text={this.state.text} toggle_mode={this.toggle_mode} />);
        } else {
            contents = (<RunScreen MIPS={this.props.MIPS} text={this.state.text} toggle_mode={this.toggle_mode} />);
        }

        // Render
        return (
            <div className="main">
			    <div className="header noselect">
                    <span className="title">MIPS Studio</span><span className="subtitle">/ {display_mode}</span>
                    <button className="test_button rounded" onClick={this.run_tests}>Run Tests</button>
                </div>
                <div className="content">{ contents }</div>
            </div>
		);
	}
});

var Editor = React.createClass({
	update_text: function(e) {
        // Propagates changes to the top level component for storage
		this.props.change(e.target.value);
	},
	update_position: function(e) {
	    // Update the scroll position of the line numbers.
        // Operates directly on DOM nodes due to React limitations
	    var position = e.target.scrollTop;
	    var node = this.getDOMNode();
	    var indicator = node.querySelector(".line_indicator");
	    indicator.scrollTop = position;
	},
	render: function() {
	    var numlines = this.props.text.split("\n").length;

		return (
            <div className="fullscreen">
                <LineIndicator numlines={numlines} />
                <textarea className="editor" placeholder="enter MIPS code here..." spellCheck="false" onChange={this.update_text} onScroll={this.update_position} value={this.props.text}></textarea>
                <EditFloater className="floater" toggle_mode={this.props.toggle_mode} />
            </div>
        );
    }
});

var LineIndicator = React.createClass({
    render: function() {
        var numlines = this.props.numlines;

        // Render all fo the line numbers
        var lines = [];
        for(var i = 0; i < numlines; i++) {
            lines.push(<div className="line" key={"key" + i}>{(i + 1) + ":"}</div>);
        }

        return (
        <div className="line_indicator">
            {lines}
        </div>
        );
    }
});

var RunScreen = React.createClass({
    getInitialState: function() {
        // Parse the data
        var parse_result = this.props.MIPS.Parser.parse(this.props.text);

        // Determine if there is a parse error
        // Create the runtime if not
        var parse_success = !parse_result.error;

        var runtime = null;
        var state = null;
        if(parse_success) {
            runtime = this.props.MIPS.Runtime.create(parse_result.data, parse_result.text);
            state = runtime.get_state();
        }

        // Return the initial state
        return {
            parse_result: parse_result,
            parse_success: parse_success,
            runtime: runtime,
            state: state
        }
    },
    run_step: function() {
        // Executes a single instruction
        var result = this.state.runtime.run_n(1);
        var state = {
            parse_result: this.state.parse_result,
            parse_success: this.state.parse_success,
            runtime: this.state.runtime,
            state: result
        };
        this.setState(state);
    },
    run_end: function() {
        // Runs the program until exit/error in a non-blocking fashion
        var that = this;
        var runner = function() {
            var result = that.state.runtime.run_n(10000);
            var state = {
                parse_result: that.state.parse_result,
                parse_success: that.state.parse_success,
                runtime: that.state.runtime,
                state: result
            };
            that.setState(state);

            // Continue if not complete
            if(!result.has_exited) {
                window.requestAnimationFrame(runner);
            }
        };

        // Start the process
        runner();
    },
    reset: function() {
        // Resets the simulator to its original state
        this.state.runtime.reset();
        var result = this.state.runtime.get_state();
        var state = {
            parse_result: this.state.parse_result,
            parse_success: this.state.parse_success,
            runtime: this.state.runtime,
            state: result
        };
        this.setState(state);
    },
    render: function() {
        // Get the current value of the PC registers
        var pc = null;
        if(this.state.state) {
            pc = this.state.state.registers["PC"];
        }

        // Collect together some handles to pass into the floater
        var handlers = {
            run_step: this.run_step,
            run_end: this.run_end,
            reset: this.reset
        };

        // Gather the main content
        var main_content = null;
        if(!this.state.parse_success) {
            main_content = (<ErrorMessage error={this.state.parse_result} context="Parse" />);
        } else {
            main_content = [
                <div className="left" key="left">
                    <Sidebar state={this.state.state} utils={this.props.MIPS.Utils} />
                </div>,
                <div className="right" key="right">
                    <InstructionList list={this.state.parse_result.text.raw} utils={this.props.MIPS.Utils} pc={pc} />
                </div>
            ];
        }
        
        // Put it all together
        return (
            <div className="fullscreen">
                <div className="runscreen">{ main_content }</div>
                <RunFloater toggle_mode={this.props.toggle_mode} handlers={handlers} state={this.state} />
            </div>
        );
    }
});

// The button in the corner that allows one to switch to "run" mode.
var EditFloater = React.createClass({
    render: function() {
        return (
            <div className="floater noselect">
                <FloaterButton action={this.props.toggle_mode} glyph="" text="Run" />
            </div>
        );
    }
});

// Contains various runtime controls and displays runtime errors.
var RunFloater = React.createClass({
    render: function() {
        // Render the correct set of buttons
        var buttons = <span></span>;
        if(this.props.state.parse_success) {
            if(this.props.state.state.has_exited) {
                // Show the reset button
                buttons = [<FloaterButton action={this.props.handlers.reset} glyph="" text="Reset" />];
                } else {
                // Show the step and run to end buttons
                buttons = [<FloaterButton action={this.props.handlers.run_step} glyph="" text="Step" />,<FloaterButton action={this.props.handlers.run_end} glyph="" text="Run To End" />];
            }

            // Determine if there is a runtime error, and display it if so.
            var error = this.props.state.state.error;
            if(error) {
                buttons = [<ErrorMessage context="Runtime" error={error}/>];
            }
        }

        return (
            <div className="floater noselect">
                <span className="buttons">{ buttons }</span>
                <FloaterButton action={this.props.toggle_mode} glyph="" text="Back To Edit" />
            </div>
        );
    }
});

// Displays instructions in a table
var InstructionList = React.createClass({
    render: function() {
        var props = this.props;
        var list = props.list;

        var table_contents = list.map(function(elem) {

            var instructions = [];
            for(var i = 0; i < elem.instructions.length; i++) {
                var insts = elem.instructions[i];
                var addr = elem.base + (i * 4);

                // Highlight the current instruction
                var class_name = "";
                if(addr === props.pc) {
                    class_name = "highlight";
                }

                // Render each parsed instruction
                instructions.push(
                    <div key={insts.inst} className={class_name}>
                        <span className="PC">{"[" + props.utils.Math.to_hex(addr) + "]" }</span> 
                        <span className="inst">{insts.inst + " " + insts.args.join(", ") }</span>
                    </div>
                );
            }

            // Return the whole table row
            return (
                <tr key={elem.line}>
                    <td>{ elem.line }</td>
                    <td>{ instructions }</td>
                    <td>{ props.utils.Parser.unescape_string(elem.text) }</td>
                    <td>{ elem.comment }</td>
                </tr>
            );
        });

        // Return the final rendered table
        return (
            <table className="instruction_list">
                <tr className="header noselect"><td>Line #</td><td>Instructions</td><td>Raw Instruction</td><td>Line Comment</td></tr>
                { table_contents }
            </table>
        );
    }
});

// The runtime sidebar for displaying simulation status.
var Sidebar = React.createClass({
    render: function() {
        // Render all of the registers
        var registers = [];
        for(var i = 0; i < 32; i++) {
            var reg = "$" + i;
            var value = this.props.state.registers[reg];

            // Maps register numbers to human-readable names.
            var namemap = {
                "$1": "at",
                "$2": "v0",
                "$3": "v1",
                "$4": "a0",
                "$5": "a1",
                "$6": "a2",
                "$7": "a3",
                "$8": "t0",
                "$9": "t1",
                "$10": "t2",
                "$11": "t3",
                "$12": "t4",
                "$13": "t5",
                "$14": "t6",
                "$15": "t7",
                "$16": "s0",
                "$17": "s1",
                "$18": "s2",
                "$19": "s3",
                "$20": "s4",
                "$21": "s5",
                "$22": "s6",
                "$23": "s7",
                "$24": "t8",
                "$25": "t9",
                "$26": "k0",
                "$27": "k1",
                "$28": "gp",
                "$29": "sp",
                "$30": "fp",
                "$31": "ra",
            }

            // Enhance the register name
            var name = namemap[reg];
            if(name) {
                name = reg + " [" + name + "]";
            } else {
                name = reg;
            }

            // Add the final register to the list
            registers.push(<WordDisplay id={name} name={name} datavalue={this.props.state.registers[reg]} utils={this.props.utils} />)
        }

        // Return the final sidebar
        return (
            <div className="sidebar">
                <div className="cycle_info">
                    <div className="word_display"><span className="name">Cycles Elapsed: </span>{this.props.state.cycles}</div>
                    <div className="word_display"><span className="name">Exited: </span>{this.props.state.has_exited ? "True" : "False" }</div>
                </div>

                <div className="reglist">
                    <WordDisplay name="PC" id="PC" datavalue={this.props.state.registers["PC"]} utils={this.props.utils} />
                    <WordDisplay name="HI" id="HI" datavalue={this.props.state.registers["HI"]} utils={this.props.utils} />
                    <WordDisplay name="LO" id="LO" datavalue={this.props.state.registers["LO"]} utils={this.props.utils} />
                </div>

                <div className="section_name">MAIN REGISTERS</div>
                <div className="reglist mainregs">
                    { registers }
                </div>

                <div className="section_name">CONSOLE OUTPUT</div>
                <div className="console_info">
                    <textarea enabled="false" value={this.props.state.output} placeholder="no console output yet..."></textarea>
                </div>
            </div>
        );
    }
});

// Displays a word of content with a name and the ability to switch between hex/signed/unsigned
var WordDisplay = React.createClass({
    getInitialState: function() {
        return {
            mode: "hex"
        };
    },
    set_hex: function() {
        this.setState({
            mode: "hex"
        });
    },
    set_signed: function() {
        this.setState({
            mode: "signed"
        });
    },
    set_unsigned: function() {
        this.setState({
            mode: "unsigned"
        });
    },
    render: function() {
        // Set the proper highlight and value
        var hex_highlight = "";
        var signed_highlight = "";
        var unsigned_highlight = "";
        var value = 0;
        if(this.state.mode === "hex") {
            hex_highlight = "highlight";
            value = this.props.utils.Math.to_hex(this.props.datavalue);
        }
        if(this.state.mode === "signed") {
            signed_highlight = "highlight";
            value = this.props.utils.Math.to_signed(this.props.datavalue, 32);
        }
        if(this.state.mode === "unsigned") {
            unsigned_highlight = "highlight";
            value = this.props.utils.Math.to_unsigned(this.props.datavalue, 32);
        }

        return (
            <div className="word_display">
                <span className="name">{this.props.name}:</span>
                <span className="value">{ value }</span>
                <span className="toggles">
                    <span onClick={this.set_hex} title="view as hexadecimal" className={hex_highlight}>#</span>
                    <span onClick={this.set_signed} title="view as signed integer" className={signed_highlight}>±</span>
                    <span onClick={this.set_unsigned} title="view as unsigned integer" className={unsigned_highlight}>+</span>
                </span>
            </div>
        )
    }
});

// Componenet for displaying an error message, with 'message' and 'code' attributes
var ErrorMessage = React.createClass({
    render: function() {
        return (
            <div className="error">
                <h1>{this.props.context + " Error!"}</h1>
                <h2>{this.props.error.message}</h2>
                <h3>Code: {this.props.error.code}</h3>
                <p>Fix this error, then try again.</p>
            </div>
        );
    }
});

// Stylized button (and associated action) for use in floaters.
var FloaterButton = React.createClass({
    render: function() {
        return (
            <div className="floater_button" onClick={this.props.action}>
                <span className="glyph">{this.props.glyph}</span>
                <span>{this.props.text}</span>
            </div>
        );
    }
});