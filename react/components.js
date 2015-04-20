// The overall UI of the page
var Studio = React.createClass({
    getInitialState: function() {
        return {
            mode: "edit",
            text: "",
            name: null
        }
    },
    run_tests: function() {
        // Runs the unit tests
        this.props.Tests.run_tests(this.props.MIPS);
        alert("Tests complete! Check web console for results.");
    },
    toggle_mode: function() {
        // Save the file
        this.save_file();

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
    show_open_popup: function() {
        show_overlay(
            OpenPopup, 
            {open: this.open_file}
        );
    },
    open_file: function(name, text) {
        var state = this.state;
        state.mode = "edit";
        state.name = name;
        state.text = text;
        this.setState(state);
    },
    save_file: function() {
        var that = this;

        // Do we need to show the popup?
        if(that.state.name === null) {
            that.show_save_popup();
            return;
        }

        // If we made it here, we need to update
        database.save(that.state.name, that.state.text, function(){});
    },
    show_save_popup: function() {
        // Define what occurs when data is saved
        var that = this;
        var save = function(name) {
            database.create(name, that.state.text, function() {
                var state = that.state;
                that.state.name = name;
                that.setState(state);
                close_overlay();
            });
        }

        // Show the overlay
        show_overlay(
            SavePopup, 
            {save: save}
        );
    },
    render: function() {
        // Get the project name
        var project_name = "\"Unsaved Project\"";
        if(this.state.name !== null) {
            project_name = "\"" + this.state.name + "\"";
        }

        // Set the display mode
        var display_mode = "Editing " + project_name;
        if(this.state.mode === "run") {
            display_mode = "Running " + project_name;
        }

        // Set the correct contents for various parts of the UI
        var contents = null;
        if(this.state.mode === "edit") {
            contents = (<Editor change={this.update_text} text={this.state.text} toggle_mode={this.toggle_mode} save={this.save_file} />);
        } else {
            contents = (<RunScreen MIPS={this.props.MIPS} text={this.state.text} toggle_mode={this.toggle_mode} />);
        }

        // Render
        return (
            <div className="main">
			    <div className="header noselect">
                    <span className="title">MIPS Studio</span><span className="subtitle">/ {display_mode}</span>
                    <button className="button rounded" onClick={this.show_open_popup}>Open Project</button>
                    <button className="button test_button rounded" onClick={this.run_tests}>Run Tests</button>
                </div>
                <div className="content">{ contents }</div>
            </div>
		);
	}
});

// Pop-up for opening a project
var OpenPopup = React.createClass({
    getInitialState: function() {
        return {
            list: [],
            loading: true
        }
    },
    componentDidMount: function() {
        // Requests the list
        this.update_list();
    },
    update_list: function() {
        var that = this;
        var state = this.state;
        state.loading = true;
        that.setState(state); // Indicate that we are loading

        database.list(function(data) {
            state.list = data.projects.sort();
            state.loading = false;
            // Display the data
            that.setState(state);
        });
    },
    remove: function(name) {
        var state = this.state;
        state.loading = true;
        this.setState(state); // Show the loading screen...

        var that = this;
        database.remove(name, function(data) {
            that.update_list();
        });
    },
    open: function(name) {
        var that = this;

        // Blank or file?
        if(!name) {
            // Open a blank file
            this.props.open(null, "");
        } else {
            // Load the full data
            database.open(name, function(data) {
                // Call the open function from props
                that.props.open(name, data.text);
            });
        }

        // Close the overlay
        close_overlay();
    },
    render: function() {
        var that = this;

        var list_content = null;
        if(this.state.loading) {
            list_content = [<div>loading...</div>];
            } else {
            if(this.state.list.length === 0) {
                list_content = [<div>You haven't created any projects yet.</div>];
            } else {
                list_content = this.state.list.map(function(elem) {
                    var remove = function() {
                        that.remove(elem);
                    };

                    var open = function() {
                        that.open(elem);
                    };

                    return (
                        <div className="list_elem noselect">
                            <span className="name" title="Click to open this project." onClick={open} key={elem}>{elem}</span>
                            <span className="delete" onClick={remove} title="Permanantly remove this project">Delete</span>
                        </div>
                    );
                });
            }
        }

        // When the "new project" button is clicked, tell the parent to create a blank file
        var that = this;
        var open_new = function() {
            that.open(null);
        };

        return (
            <div className="popup">
                <h1>Open Project</h1>
                <div className="project_list">{ list_content }</div>
                <FloaterButton text="New Project" glyph="" action={ open_new } />
            </div>
        );
    }
});

// Pop-up for saving a new project
var SavePopup = React.createClass({
    render: function() {
        var that = this;
        var save = function() {
            var name = that.getDOMNode().querySelector("input").value;
            if(name.length > 0) {
                that.props.save(name);
            }
        }

        return (
            <div className="popup">
                <h1>Save New Project</h1>
                <div>You need to give your project a name before you can continue.</div>
                <input type="text" placeholder="project name" /><br/>
                <FloaterButton text="Save Project" glyph="" action={ save } />
            </div>
        );
    }
});

// The complete edit mode component.
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
                <EditFloater className="floater" toggle_mode={this.props.toggle_mode} save={this.props.save}/>
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
            if(!result.has_exited && !result.breaked) {
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
    toggle_breakpoint: function(line) {
        var result = this.state.runtime.toggle_breakpoint(line);
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

        // Collect together some stuff related to breakpoints
        var breakpoints = null;
        if(this.state.parse_success) {
            breakpoints = {
                points: this.state.state.breakpoints,
                toggle: this.toggle_breakpoint
            };
        }

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
                    <InstructionList list={this.state.parse_result.text.raw} utils={this.props.MIPS.Utils} pc={pc} breakpoints={breakpoints} />
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
                <FloaterButton action={this.props.toggle_mode} glyph="" text="Run" title="Save and run the program." />
                <FloaterButton action={this.props.save} glyph="" text="Save" title="Save the program back to the server."/>
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
                var run_continue_text = this.props.state.state.breaked ? "Continue" : "Run To End";
                buttons = [<FloaterButton action={this.props.handlers.run_step} glyph="" text="Step" />,<FloaterButton action={this.props.handlers.run_end} glyph="" text={run_continue_text} />];
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
                    <td><Breakpoint line_num={elem.line} breakpoints={props.breakpoints}/></td>
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

// Renders a line number and breakpoint indicator in the instruction list
var Breakpoint = React.createClass({
    render: function() {
        var points = this.props.breakpoints.points;
        var line_num = this.props.line_num;

        var class_name = "breakpoint";
        if(points.indexOf(line_num) !== -1) {
            class_name += " breaked";
        }

        var that = this;
        var toggle = function() {
            that.props.breakpoints.toggle(line_num);
        };

        return (
            <div className={class_name} onClick={toggle}>
                <span className="dot" title="click to toggle a breakpoint at this line">○</span>
                <span className="number">{line_num}</span>
            </div>
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
            <div className="floater_button noselect" onClick={this.props.action}>
                <span className="glyph">{this.props.glyph}</span>
                <span>{this.props.text}</span>
            </div>
        );
    }
});

