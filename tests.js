define(function () {
    // A basic assertion library
    var assert = {
        equals: function (test, target) {
            if (test !== target) {
                throw "" + test + " is not equal to " + target + ".";
            }
        },
        isNull: function (test) {
            if (test !== null) {
                throw "The input was not null when it should have been."
            }
        },
        isNotNull: function (test) {
            if (test === null) {
                throw "The input was null when it should not have been.";
            }
        },
        isFalsey: function(test) {
            if(test) {
                throw "The input was truthy when it should have been falsy.";
            }
        },
        isTruthy: function (test) {
            if (!test) {
                throw "The input was falsey when it should have been truthy.";
            }
        },
        hasLength: function (test, length) {
            if (test.length !== length) {
                throw "Array has length " + test.length + " instead of the expected " + length + ".";
            }
        }
    };

    // Create the tests { name: "string", test: function(MIPS){} }
    var tests = [];

    // Test detection of a bad constant
    tests.push({
        name: "Bad Constant",
        test: function (MIPS) {
            var text = "BAD = 0xFFFFFFFFF\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 0);
        }
    });

    // Test detection of more than one data segment
    tests.push({
        name: "Multiple Data Segments",
        test: function (MIPS) {
            var text = ".data\n.word 55\n.data\n.byte 20\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 1);
        }
    });

    // Test detection of lack of a text segment
    tests.push({
        name: "No Text Segment",
        test: function (MIPS) {
            var text = ".data\n.word 55";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 2);
        }
    });

    // Test detection of text segment before data
    tests.push({
        name: "Text Before Data",
        test: function (MIPS) {
            var text = ".text\njr $ra\n.data\n.word 55";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 3);
        }
    });

    // Test detection of lack of data segment line type
    tests.push({
        name: "No Data Line Type",
        test: function (MIPS) {
            var text = ".data\n55\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 4);
        }
    });

    // Test detection of invalid data segment byte
    tests.push({
        name: "Bad Data Byte",
        test: function (MIPS) {
            var text = ".data\n.byte 0xFFF\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 5);
        }
    });

    // Test detection of invalid data segment half
    tests.push({
        name: "Bad Data Half",
        test: function (MIPS) {
            var text = ".data\n.half 0xFFFFF\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 5);
        }
    });

    // Test detection of invalid data segment word
    tests.push({
        name: "Bad Data Word",
        test: function (MIPS) {
            var text = ".data\n.word 0xFFFFFFFFF\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 5);
        }
    });

    // Test detection of invalid data segment string
    tests.push({
        name: "Bad Data String",
        test: function (MIPS) {
            var text = ".data\n.asciiz 'c'\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 5);
        }
    });

    // Test detection of invalid data segment align
    tests.push({
        name: "Bad Data Align",
        test: function (MIPS) {
            var text = ".data\n.align 0\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 5);
        }
    });

    // Test detection of no arguments to data type
    tests.push({
        name: "No Data Arguments",
        test: function (MIPS) {
            var text = ".data\n.align \n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 6);
        }
    });

    // Test detection of segment size exceedance
    tests.push({
        name: "Max Data Segment Size",
        test: function (MIPS) {
            var text = ".data\n.space 0xFFFFF\n.space 0xFFFFF\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 7);
        }
    });

    // Test data segment label mismatch
    tests.push({
        name: "Data Segment Label Mismatch",
        test: function (MIPS) {
            var text = ".data\nlabel: .word 55\n.word nolabel\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 8);
        }
    });

    // Test label declaration duplication in data segment
    tests.push({
        name: "Data Segment Label Duplication",
        test: function (MIPS) {
            var text = ".data\nlabel: .word 55\nlabel: .word 42\n.text\nmain:\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 9);
        }
    });

    // Test invalid instruction detection
    tests.push({
        name: "Invalid Instruction",
        test: function (MIPS) {
            var text = ".text\nmain:\nnop $ra $t0 5";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 10);
        }
    });

    // Test invalid instruction arugment error detection
    tests.push({
        name: "Invalid Instruction Args",
        test: function (MIPS) {
            var text = ".text\nmain:\nj $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 11);
        }
    });

    // Test lack of main label
    tests.push({
        name: "No Main Label",
        test: function (MIPS) {
            var text = ".text\njr $ra";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 12);
        }
    });

    // Test text segment label mismatch
    tests.push({
        name: "Text Segment Label Mismatch",
        test: function (MIPS) {
            var text = ".text\nmain: j nolabel";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 8);
        }
    });

    // Test label declaration duplication in text segment
    tests.push({
        name: "Text Segment Label Duplication",
        test: function (MIPS) {
            var text = ".text\nmain: j main\nmain: add $t0, $t1, $t2";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 9);
        }
    });

    // Test invalid write to register zero detection (at parse)
    tests.push({
        name: "Register Zero Write",
        test: function (MIPS) {
            var text = ".text\nmain: add $zero, $t0, 55";

            var parse = MIPS.Parser.parse(text);

            assert.isTruthy(parse.error);
            assert.equals(parse.code, 16);
        }
    });

    // Test runtime maximum cycle count detection
    tests.push({
        name: "Maximum Cycle Count",
        test: function (MIPS) {
            var text = ".text\nmain: j main";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();

            assert.isTruthy(state.error);
            assert.equals(state.error.code, 13);
        }
    });

    // Test invalid instruction address
    tests.push({
        name: "Invalid Instruction Address",
        test: function (MIPS) {
            var text = ".text\nmain: j 0xFF1234";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();

            assert.isTruthy(state.error);
            assert.equals(state.error.code, 14);
        }
    });

    // Test runtime attempt to divide by zero
    tests.push({
        name: "Divide By Zero",
        test: function (MIPS) {
            var text = ".text\nmain:\nli $t0 0\ndiv $t1, $1, $t0";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();

            assert.isTruthy(state.error);
            assert.equals(state.error.code, 18);
        }
    });

    // Test segmentation fault detection
    tests.push({
        name: "Segmentation Fault",
        test: function (MIPS) {
            var text = ".text\nmain:\nlw $t0, 0x12345678($zero)";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();

            assert.isTruthy(state.error);
            assert.equals(state.error.code, 19);
        }
    });

    // Test stack overflow exception
    tests.push({
        name: "Stack Overflow",
        test: function (MIPS) {
            var text = ".text\nmain:\nsub $sp, $sp, 4\nsw $ra, 0($sp)\njal main\nlw $ra, 0($sp)\nadd $sp, $sp, 4\njr $ra";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();

            assert.isTruthy(state.error);
            assert.equals(state.error.code, 20);
        }
    });

    // Test unaligned load or store detection
    tests.push({
        name: "Unaligned Load/Store",
        test: function (MIPS) {
            var text = ".data\ndata: .word 55\n.text\nmain:\nla $t0, data\nadd $t0, $t0, 2\nlw $t1, 0($t0)";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();

            assert.isTruthy(state.error);
            assert.equals(state.error.code, 21);
        }
    });

    // Test basic arithmatic
    tests.push({
        name: "Basic Arithmatic",
        test: function (MIPS) {
            var text = ".text\nmain:\nadd $2, $0, 0xFF\nadd $3, $0, $2\nadd $4, $0, 0x12345678\nsub $5, $0, 0xFF\nsub $6, $0, $5\nsub $7, $0, 0x12345678\nli $8, 2\nmul $9, $8, 8\nmul $10, $9, $8\nmul $11, $8, 0x12345678\ndiv $12, $10, 2\ndiv $13, $12, $8\ndiv $14, $11, 0x12345678";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$2"], 0xFF);
            assert.equals(registers["$3"], 0xFF);
            assert.equals(registers["$4"], 0x12345678);
            assert.equals(registers["$5"], 0xFFFFFF01);
            assert.equals(registers["$6"], 0xFF);
            assert.equals(registers["$7"], 0xEDCBA988);
            assert.equals(registers["$8"], 2);
            assert.equals(registers["$9"], 16);
            assert.equals(registers["$10"], 32);
            assert.equals(registers["$11"], 0x12345678 * 2);
            assert.equals(registers["$12"], 16);
            assert.equals(registers["$13"], 8);
            assert.equals(registers["$14"], 2);
        }
    });

    // Test bitwise arithmatic
    tests.push({
        name: "Bitwise Arithmatic",
        test: function (MIPS) {
            var text = ".text\nmain:\nli $2 0x55555555\nli $3 0xAAAAAAAA\nor $4, $2, $3\nor $5, $2, 0xFFFF\nor $6, $2, 0xFFFF0000\nand $7, $2, $3\nand $8, $2, 0xFFFF\nand $9, $2, 0xFFFF0000\nxor $10, $2, $3\nnor $11, $2, $3";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$2"], 0x55555555);
            assert.equals(registers["$3"], 0xAAAAAAAA);
            assert.equals(registers["$4"], 0xFFFFFFFF);
            assert.equals(registers["$5"], 0x5555FFFF);
            assert.equals(registers["$6"], 0xFFFF5555);
            assert.equals(registers["$7"], 0);
            assert.equals(registers["$8"], 0x5555);
            assert.equals(registers["$9"], 0x55550000);
            assert.equals(registers["$10"], 0xFFFFFFFF);
            assert.equals(registers["$11"], 0);
        }
    });

    // Test pseudoinstructions
    tests.push({
        name: "Pseudoinstructions",
        test: function (MIPS) {
            var text = ".data\ndlabel: .word 42\n.text\nmain:\nli $2, 0x12345678\nla $3, dlabel\nabs $4, $2\nmul $5, $2, -1\nabs $5, $5\nli $6, 0x12345678\nclear $6\nli $7, 0xFFFF\nnot $7, $7\nmove $8, $7\nli $9, 55\nrem $9, $9, 10";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$2"], 0x12345678);
            assert.equals(registers["$3"], 0x10000000);
            assert.equals(registers["$4"], 0x12345678);
            assert.equals(registers["$5"], 0x12345678);
            assert.equals(registers["$6"], 0);
            assert.equals(registers["$7"], 0xFFFF0000);
            assert.equals(registers["$8"], 0xFFFF0000);
            assert.equals(registers["$9"], 5);
        }
    });

    // Test bitwise shifts
    tests.push({
        name: "Bitwise Shifts",
        test: function (MIPS) {
            var text = ".text\nmain:\nli $2, 0x12345678\nsll $3, $2, 8\nsrl $4, $3, 8\nli $5, 8\nsllv $6, $2, $5\nsrlv $7, $6, $5";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$2"], 0x12345678);
            assert.equals(registers["$3"], 0x34567800);
            assert.equals(registers["$4"], 0x00345678);
            assert.equals(registers["$5"], 8);
            assert.equals(registers["$6"], 0x34567800);
            assert.equals(registers["$7"], 0x00345678);
        }
    });

    // Test control flow
    tests.push({
        name: "Branching",
        test: function (MIPS) {
            var text = ".text\nmain:\nli $2, 5\n\nbeq $2, 5, skip1\nli $3, 0xDEADBEEF\n\nskip1:\nli $2, 4\nbne $2, 5, skip2\nli $4, 0xDEADBEEF\n\nskip2:\nli $2, 4\nblt $2, 5, skip3\nli $5, 0xDEADBEEF\n\nskip3:\nli $2, 6\nbgt $2, 5, skip4\nli $6, 0xDEADBEEF\n\nskip4:\nli $2, 5\nble $2, 5, skip5\nli $7, 0xDEADBEEF\n\nskip5:\nbge $2, 5, end\nli $8, 0xDEADBEEF\n\nend:\nli $9, 0x12345678";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$2"], 5);
            assert.equals(registers["$3"], 0);
            assert.equals(registers["$4"], 0);
            assert.equals(registers["$5"], 0);
            assert.equals(registers["$6"], 0);
            assert.equals(registers["$7"], 0);
            assert.equals(registers["$8"], 0);
            assert.equals(registers["$9"], 0x12345678);
        }
    });

    // Test function calls (jal, j, jr)
    tests.push({
        name: "Function Calls",
        test: function (MIPS) {
            var text = ".text\nmain:\nsub $sp, $sp, 4\nsw $ra, 0($sp)\njal function\nlw $ra, 0($sp)\nadd $sp, $sp, 4\nli $5, 0x12345678\njr $ra\n\nfunction:\nli $2, 0x12345678\nj jumptar\n\njumpret:\nli $4, 0x12345678\njr $ra\n\njumptar:\nli $3, 0x12345678\nj jumpret";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$2"], 0x12345678);
            assert.equals(registers["$3"], 0x12345678);
            assert.equals(registers["$4"], 0x12345678);
            assert.equals(registers["$5"], 0x12345678);
        }
    });

    // Test syscalls
    tests.push({
        name: "Syscalls",
        test: function (MIPS) {
            var text = ".data\nstring: .asciiz \"test\"\nchar: .byte 'Q'\n.text\nmain:\nli $v0, 1\nli $a0, 12345678\nsyscall\nli $v0, 4\nla $a0, string\nsyscall\nli $v0, 11\nlb $a0, char\nsyscall\nli $v0, 10\nsyscall\nli $10, 0xDEADBEEF";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$10"], 0);
            assert.equals(state.output, "12345678testQ");
        }
    });

    // Test loads and stores
    tests.push({
        name: "Loads and Stores",
        test: function (MIPS) {
            var text = ".data\ndata: .word 0x12345678\n.text\nmain:\nlw $2, data\nlh $3, data\nla $4, data\nlh $4, 2($4)\nlb $5, data\nla $6, data\nlb $6, 1($6)\nli $7, 0x23456789\nsw $7, data\nli $8, 0xFFFF\nsh $8, data\nli $9, 0x42\nsb $9, data\nlw $10, data";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$2"], 0x12345678);
            assert.equals(registers["$3"], 0x5678);
            assert.equals(registers["$4"], 0x1234);
            assert.equals(registers["$5"], 0x78);
            assert.equals(registers["$6"], 0x56);
            assert.equals(registers["$10"], 0x2345FF42);
        }
    });

    // Test new CS 242 Week 3 instructions
    tests.push({
        name: "Week 3 Instructions",
        test: function (MIPS) {
            var text = ".text\nmain:\nli $t0, 0xFFFFFFFF\nxor $t0, $t0, 0x55555555\nli $t1 0x0\nnor $t1, $t1, 0x55555555\nli $t2 0\nbgtz $t2 skip1\nli $t2 0x12345678\nskip1:\nli $t3 1\nbgtz $t3 skip2\nli $s0 0xDEADBEEF\nskip2: li $t4 0\nbltz $t4 skip3\nli $t4 0x12345678\nskip3: li $t5 -1\nbltz $t5 skip4\nli $s1 0xDEADBEEF\nskip4:\nli $s3, 0";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text);
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$8"], 0xAAAAAAAA);
            assert.equals(registers["$9"], 0xAAAAAAAA);
            assert.equals(registers["$10"], 0x12345678);
            assert.equals(registers["$11"], 0x1);
            assert.equals(registers["$12"], 0x12345678);
            assert.equals(registers["$13"], 0xFFFFFFFF);
            assert.equals(registers["$16"], 0x0);
            assert.equals(registers["$17"], 0x0);
        }
    });

    // Test basic IO interaction
    tests.push({
        name: "Basic IO",
        test: function (MIPS) {
            var text = "addr = 0xFFFF0000\n.text\nmain:\nli $t0 2990\nsw $t0 addr\n\nloop:\nlw $t0 addr\nbne $t0 0 loop\n\nend:\njr $ra";

            var parse = MIPS.Parser.parse(text);
            var runtime = MIPS.Runtime.create(parse.data, parse.text, basic_io.create());
            var state = runtime.run_to_end();
            var registers = state.registers;

            assert.equals(registers["$8"], 0);
            assert.equals(state.cycles, 3000);
        }
    });

    // Runs the tests
    var run_tests = function (MIPS) {
        console.log("Running tests...");
        var success_count = 0;
        for (var i = 0; i < tests.length; i++) {
            var result_string = tests[i].name + ": ";

            try {
                tests[i].test(MIPS);
                result_string += "Passed!";
                success_count += 1;
            } catch (ex) {
                result_string += "FAILED. " + ex;
            }

            console.log(result_string);
        }

        // Print a summary
        if (success_count == tests.length) {
            console.log("All tests passed!");
        } else {
            console.log("Some failures. " + success_count + "  out of " + tests.length + " tests passed.");
        }
    };

    // Return out the interface
    return {
        run_tests: run_tests
    };
});
