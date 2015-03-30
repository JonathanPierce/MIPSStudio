MIPS Studio
==========

**An interactive MIPS assembly interpreter in HTML5/JavaScript**

Currently, it is capable of:

- Parsing .data sand .text segments into executable
- Parsing and running most common MIPS instructions/pseudoinstructions
- Single-step or bulk interpetation of instructions
- Providing useful errors and output

Try it out via testbed.html (test.s is an excellant sample program)!

==========

To compile for use with require.js: run "python compile.py" to create mips.js.

==========

In the future, I hope to:

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