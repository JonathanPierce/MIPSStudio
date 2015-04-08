MIPS Studio
==========

**An interactive MIPS assembly interpreter in HTML5/JavaScript**

Currently, it is capable of:

- Parsing .data sand .text segments into executable
- Parsing and running most common MIPS instructions/pseudoinstructions
- Single-step or bulk interpetation of instructions
- Providing useful errors and output

Try it out via testbed.html (test.s is an excellant sample MIPS program)!

==========

## Compilation

To compile for use with require.js: run "python compile.py" to create mips.js.

==========

## Usage

With require (assuming mips.js is in the same diretory as the calling script):

''''javascript
require(["mips"], function(MIPS) {
	var text = "mips code here";
	// 'text' is the MIPS we want to parse/run as a javascript string
	var parse_result = MIPS.Parser.parse(text);

	// check for errors
	if(!parse_result.error) {
		// Create the runtime
		var runtime = MIPS.Runtime.create(parse_result.data, parse_result.text);

		// Run to completion or error
		var state = runtime.run_to_end();
	}
});
''''

### Parser Results

MIPS.Parser.parse(text) will parse the 'text' string and returns an object with properties:

- error: Either boolean 'false' (indicating no error), or an exception object. If an exception is present, none of the following properties will be.
- constants: A hash table mapping constants to their values.
- data: The data segment object. See data.js for more information.
- text: The text segment object. See text.js for more information.

### Runtime Usage

MIPS.Runtime.create(data_object, text_object) will create a runtime from the data and text objects returned from the parser. The runtime object has the following methods:

- run_n(int): Runs int cycles, or stops before if the program ends or there is an error. Returns the state after completion.
- run_to_end(): Runs the program until it terminates due to completion or error. Returns the state after completion.
- get_state(): Returns the current state of the runtime.
- reset(): Resets the runtime (and its memory) to its original state.

The runtime state object contains the following properties:

- registers: A hash table mapping register names (eg: "PC" or "$5") to their current values
- has_exited: Boolean that indicates whether or not the system has exited (either due to error or program completion)
- cycles: The current number of elapsed cycles.
- data: The current state of the data segment (as a hash table mapping addresses to bytes)
- stack: The current state of the stack segment (as a hash table mapping addresses to bytes)
- error: The current error, or null if none.
- output: A string indicating what the MIPS program has printed to the virtual 'temrinal'
- current_inst: The last executed instruction.

==========

## Future Plans

In the (distant) future, I hope to:

- Support .kdata, .ktext, and interrupts
- Support for basic extended addressing modes (eg: "lbu $a0 4+oldest($sp)")
- Support for more isntructions and pseudoinstructions, and more intelligent psuedoinstruction conversion.
- Support for lines with multiple labels
- Support for custom IO modules (such as SPIMbot)
- Support for ".globl" and multiple-file programs/linking
- Protections aginst using $at, .setat, .setnoat

Unfortinately, due to limits in the capabilities of JavaScript, I don't think I'll ever (easily) be able to:

- Acheive 1-to-1 numerical behavior with a real MIPS machine
- Handle floating point numbers (single or double precion) in any fashion
- Handle the HI of a 'mul' instructions correctly.
- A total, complete, proper LR parse and subsequent assembly. Thus, many advanced expressions are not possible (eg: ".space NUM_FLAGS * 2 * 4").