define(function() {
    var Utils = (function () {
    // Constants
    var regex_hex = /^0x[0-9a-fA-F]{1,8}$/mi;
    var regex_integer = /^-?[0-9]+$/mi;
    var regex_binary = /^0(b|B)([01]{1,32}$)/mi;
    var regex_char = /^'\\?.'$/mi;
    var regex_comment = /(#|\/\/)(.*)/im;
    var regex_offset = /^(.+)\((\$.{1,4})\)$/im;
    var regex_label_dec = /^[a-zA-Z_][a-zA-Z0-9_]*:$/im;
    var regex_label = /^[a-zA-Z_][a-zA-Z0-9_]*$/im;
    var regex_type = /^\.(word|half|byte|ascii|asciiz|float|double|space|align)$/im;
    var regex_string_escape = /\"((\\\"|[^\"])+)\"/gim;
    var regex_string_lexeme = /^\"((\\\"|[^\"])*)\"$/im;
    var regex_register = /^\$([12]?[0-9]|3[01])$/im;

    // get_error: Return a proper error to throw
    var get_error = function (index, args) {
        var error_codes = [
        "Could not parse constant (^1) on line ^2.",
        "More than one data segment detected. Your code should only have one '.data' directive.",
        "Your code needs exactly one .text directive.",
        "The data segment was not found before the text segment, or there was ancillary text above the text segment.",
        "Data segment line ^1 must have a valid type.",
        "Argument '^1' is not compatible with type ^2 on line ^3.",
        "No arguments were provided to data type ^1 on line ^2.",
        "Max ^1 segment size exceeded on line ^2.",
        "No match for label '^1' on line ^2.",
        "Label '^1' duplicated on line ^2.",
        "'^1' is not a valid instruction on line ^2.",
        "One or more arguments to instruction '^1' are not valid on line ^2.",
        "Your must have a label in your text segment called 'main'.",
        "Maximum cycle count exceeded.",
        "No instruction at address ^1.",
        "An error occurred when performing instruction '^1' on line ^2.",
        "Instruction '^1' made an illegal attempt to write to register zero on line ^2.",
        "Integer overflow occured with instruction '^1' on line ^2.",
        "Illegal attempt to divide by zero on line ^1.",
        "Segmentation Fault on line ^1. :(",
        "Likely Stack Overflow on line ^1. :(",
        "Unaligned load or store on line ^1."
        ];

        var current = error_codes[index];

        args = args || [];
        for (var i = 0; i < args.length; i++) {
            var to_replace = "^" + (i + 1);

            current = current.replace(to_replace, args[i]);
        }

        return { code: index, message: current };
    };

    // Returns the match in a hash table or null
    var get = function (table, value) {
        var match = table[value];
        if (typeof match !== "undefined" && table.hasOwnProperty(value)) {
            return match;
        }
        return null;
    }

    // PARSER: Various parser helper functions
    var Parser = {
        // Returns a pair of the line without the comment and the comment
        extract_comment: function (input) {
            var without = input.replace(regex_comment, "");
            var match = input.match(regex_comment);
            var comment = "";
            if (match) {
                comment = match[0];
            }
            return { without: without, comment: comment };
        },

        // Joins an array by the propery of one of its objects
        join_by_prop: function (arr, prop, split) {
            var result = "";

            for (var i = 0; i < arr.length; i++) {
                result += arr[i][prop];

                if (i < arr.length - 1) {
                    result += split;
                }
            }

            return result;
        },

        // Wrapper for String.match that handles the case of no matches with an empty array instead of null
        apply_regex: function (regex, input) {
            var result = input.match(regex);

            return result ? result : [];
        },

        // Escapes spaces in string literals with '~@&'
        // Also handles the ' ' character
        escape_strings: function(input) {
            var matches = Parser.apply_regex(regex_string_escape, input);
            var temp = input.replace(regex_string_escape, "#");

            for (var i = 0; i < matches.length; i++) {
                matches[i] = matches[i].replace(new RegExp(" ", "g"), "~@&");
            }

            while (temp.indexOf("#") !== -1) {
                temp = temp.replace("#", matches[0]);
                matches = matches.slice(1);
            }

            // Handle the space character declaration
            temp = temp.replace(new RegExp("' '", "g"), "'~@&'");

            return temp;
        },

        // const_to_val: Converts a string to an integer value
        // NOTE: Does not check bounds or enforce signed/unsigned.
        const_to_val: function(input) {
            // Is this hex or a plain integer?
            if (regex_hex.test(input) || regex_integer.test(input)) {
                return new Number(input);
            }

            // Is this binary?
            if (regex_binary.test(input)) {
                var result = 0;
                var multiplier = 1;
                var bits = input.replace(regex_binary, "$2");

                for (var i = bits.length - 1; i >= 0; i--) {
                    if (bits[i] == '1') {
                        result += multiplier;
                    }
                    multiplier *= 2;
                }

                return result;
            }

            // Is this a charaster?
            var unescaped = Parser.unescape_string(input);
            if (regex_char.test(unescaped)) {
                if (unescaped.length === 3) {
                    return unescaped.charCodeAt(1);
                } else {
                    // Special characters like \n
                    if (unescaped === "'\\n'") {
                        return "\n".charCodeAt(0)
                    }
                    if (unescaped === "'\\t'") {
                        return "\t".charCodeAt(0)
                    }

                    // No match? FAIL.
                    throw get_error(0, [input, line]);
                }
            }

            // If we made it here, return null
            return null;
        },

        // Replaces escaped spaces with spaces in string literals
        // Also handles other escaped characters
        unescape_string: function(input) {
            var step1 = input.replace(new RegExp("~@&", "g"), " ");
            var step2 = step1.replace(/\\n/gi, "\n");
            var step3 = step2.replace(/\\t/gi, "\t");
            var step4 = step3.replace(/\\0/gi, "\0");
            var step5 = step4.replace(/\\r/gi, "\r");
            return step5;
        },

        // Returns a pair of offset, register, and the rest (if found) or null
        parse_offset: function (input) {
            if (regex_offset.test(input)) {
                var offset = input.replace(regex_offset, "$1");
                var reg = input.replace(regex_offset, "$2");
                return { offset: offset, reg: reg};
            } else {
                return null;
            }
        },

        // Is the current lexeme a label declaration? Return null if not, and ':'-free label otherwise
        is_label_dec: function (input) {
            if (regex_label_dec.test(input)) {
                return input.replace(":", "");
            }
            return null;
        },

        // Is the current lexeme a potential label use?
        is_label: function (input) {
            if (regex_label.test(input)) {
                return input;
            }
            return null;
        },

        // Is the current lexeme a valid type directive? Return null if not, and '.'-free type otherwise.
        is_type: function (input) {
            if (regex_type.test(input)) {
                return input.replace(".", "");
            }
            return null;
        },

        // Is the current lexeme a string? If so, unescape and remove " from beginning and end
        is_string: function (input) {
            if (regex_string_lexeme.test(input)) {
                input = input.slice(1, input.length - 1);
                return Parser.unescape_string(input);
            }
            return null;
        }
    };

    // TYPE: Validates that a data element is valid for a given type (and perhaps does some cleanup)
    var Type = {
        word: function (elem) {
            // Are we a potential label?
            if (Parser.is_label(elem)) {
                return elem;
            }

            // Are we a valid number?
            elem = Parser.const_to_val(elem);
            if (elem === null) {
                return null;
            }

            // Are we in range?
            if (!Math.in_bit_range(elem, 32)) {
                return null;
            }

            // Convert to unsigned and return
            return Math.to_unsigned(elem, 32);
        },

        half: function (elem) {
            // Are we a valid number?
            elem = Parser.const_to_val(elem);
            if (elem === null) {
                return null;
            }

            // Are we in range?
            if (!Math.in_bit_range(elem, 16)) {
                return null;
            }

            // Convert to unsigned and return
            return Math.to_unsigned(elem, 16);
        },

        byte: function (elem) {
            // Are we a valid number?
            elem = Parser.const_to_val(elem);
            if (elem === null) {
                return null;
            }

            // Are we in range?
            if (!Math.in_bit_range(elem, 8)) {
                return null;
            }

            // Convert to unsigned and return
            return Math.to_unsigned(elem, 8);
        },

        ascii: function (elem) {
            // Is this a string literal?
            return Parser.is_string(elem);
        },

        asciiz: function (elem) {
            // Use above function, add '\0' to the end
            var result = Type.ascii(elem);
            if (result !== null) {
                return result + "\0";
            } else {
                return null;
            }
        },

        space: function (elem) {
            // Are we a valid number?
            elem = Parser.const_to_val(elem);
            if (elem === null) {
                return null;
            }

            // Are we less than 1MB?
            if (elem < 1 || elem > 1024 * 1028 * 8) {
                return null;
            }

            // Return the number
            return elem;
        },

        align: function (elem) {
            // Are we a valid number?
            elem = Parser.const_to_val(elem);
            if (elem === null) {
                return null;
            }

            // Are we less than 1MB?
            if (elem < 1 || elem > 8) {
                return null;
            }

            // Return the number
            return elem;
        },

        reg: function (elem) {
            // Are we a register between $0 and $31?
            if (regex_register.test(elem)) {
                return elem;
            }
            return null;
        },

        imm16: function (elem) {
            // Are we a valid SIGNED 16-bit immediate?
            // Most instructions will see an out of range 16-bit value as a valid 32-bit one.
            var result = Type.half(elem);
            if (result !== null && Math.in_signed_range(result, 16)) {
                return Math.to_signed(result, 16);
            }
            return null;
        },

        imm16u: function (elem) {
            // Are we a valid *UN*SIGNED 16-bit immediate?
            return Type.half(elem);
        },

        imm32: function (elem) {
            // Are we a valid 32-bit immediate
            elem = Parser.const_to_val(elem);
            if (elem === null) {
                return null;
            }

            // Are we in range?
            if (!Math.in_bit_range(elem, 32)) {
                return null;
            }

            // Convert to unsigned and return (interpreter will convert to signed if necessary at runtime)
            return Math.to_unsigned(elem, 32);
        },

        imm26: function (elem) {
            // Are we a valid 26-bit immediate
            elem = Parser.const_to_val(elem);
            if (elem === null) {
                return null;
            }

            // Are we in range?
            if (!Math.in_bit_range(elem, 26)) {
                return null;
            }

            // Convert to unsigned and return (interpreter will convert ot signed if necessary at runtime)
            return Math.to_unsigned(elem, 26);
        }
    };

    // MATH: Various mathematical helper functions
    var Math = {
        // Converts a signed to unsigned n-bit number
        to_unsigned: function (num, bits) {
            return (num << (32 - bits)) >>> (32 - bits);
        },

        // Converts an unsinged number to its signed value
        to_signed: function (num, bits) {
            var max_of_bits = window.Math.pow(2, bits - 1) - 1;

            if (num > max_of_bits) {
                return num - window.Math.pow(2, bits);
            } else {
                return num;
            }
        },

        // Is this number (signed or not) in the range of something in this bit level?
        in_bit_range: function (num, bits) {
            var min_signed = -1 * window.Math.pow(2, bits - 1);
            var max_unsigned = window.Math.pow(2, bits) - 1;

            return num >= min_signed && num <= max_unsigned;
        },

        // Is this number (signed!!!) in the range of something in this bit level?
        in_signed_range: function (num, bits) {
            var min_signed = -1 * window.Math.pow(2, bits - 1);
            var max_signed = (min_signed * -1) - 1;

            return num >= min_signed && num <= max_signed;
        },

        // Converts a number to a hexadecimal string
        to_hex: function (input) {
            return "0x" + input.toString(16).toUpperCase();
        },

        // Splits something into n-little endian bytes
        split_to_bytes: function (input, num_bytes) {
            var result = [];

            var mask = 0xFF;

            for (var i = 0; i < num_bytes; i++) {
                result.push(input & mask);
                input = input >>> 8;
            }

            return result;
        },

        // Returns (unsigned) the top 16 bits of a word
        top_16: function (input) {
            return input >>> 16;
        },

        // Returns (unsigned) the lower 16 bits of a word
        bottom_16: function (input) {
            return input & 0x0000FFFF;
        }
    };

    // Return out the interface
    return {
        get: get,
        get_error: get_error,
        Parser: Parser,
        Type: Type,
        Math: Math
    };
})();
    
    var TextParser = (function () {
    // Constants
    var base_address = Utils.Parser.const_to_val("0x00400000");
    var max_address = Utils.Parser.const_to_val("0x00500000");

    // Validate all instructions
    var validate = function (raw) {
        // Returns true iff no write is done to register
        var check_zero_write = function (instructions) {
            var non_writing = ["syscall", "sw", "sh", "sb", "jr", "jal", "j", "beq", "bne", "bgt", "blt", "ble", "bge"];

            for (var i = 0; i < instructions.length; i++) {
                var current = instructions[i];

                // Some instruction's don't write
                if (non_writing.indexOf(current.inst) !== -1 || current.args.length < 2) {
                    continue;
                }

                // Check for a write to register zero
                if (current.args[0] === "$0") {
                    return false;
                }
            }

            return true;
        }

        // Validate each instruction
        for (var i = 0; i < raw.length; i++) {
            // Split the instruction
            var current = raw[i].text.split(" ");

            // Do we have a label? If so, consume it.
            var label_or_null = Utils.Parser.is_label_dec(current[0]);
            if (label_or_null) {
                raw[i].label = label_or_null;
                current = current.slice(1);
            } else {
                raw[i].label = null;
            }

            // Then, we MUST have a valid instruction
            current[0] = current[0].toLowerCase();
            var func_or_null = Insts[current[0]];

            // Validate and transform instructions
            if(func_or_null) {
                current = current.slice(1);
                var insts_or_null = func_or_null(current);

                if (insts_or_null) {

                    var no_write_zero = check_zero_write(insts_or_null);

                    if (no_write_zero) {
                        raw[i].instructions = insts_or_null;
                    } else {
                        throw Utils.get_error(16, [raw[i].text, raw[i].line]);
                    }
                } else {
                    throw Utils.get_error(11, [raw[i].text, raw[i].line]);
                }
            } else {
                // FAIL
                throw Utils.get_error(10, [current[0], raw[i].line]);
            }
        }

        return raw;
    };

    // Validates and converts individual (pseudo)instructions (returns 'null' on failure)
    var Insts = {
        "add": function (args, unsigned) {
            var unsigned = unsigned ? "u" : "";

            // Correct args length?
            if(args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            // reg, reg, imm16
            // reg, reg, imm32
            var valid = false;
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            if(reg1 && reg2 && reg3) {
                valid = true; // reg reg reg
            } else {
                var imm16 = Utils.Type.imm16(args[2]);
                var imm32 = Utils.Type.imm32(args[2]);
                if (reg1 && reg2 && (imm16 !== null || imm32 !== null)) {
                    valid = true;
                }
            }

            // Fail if necessary
            if(!valid) {
                return null;
            }

            // Return final instruction(s)
            if(reg3) {
                return [{ inst: "add" + unsigned, args: [reg1, reg2, reg3] }];
            }

            if(imm16 !== null) {
                return [{inst: "addi" + unsigned, args: [reg1, reg2, imm16] }];
            }

            if(imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32) ] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32) ] },
                    { inst: "add" + unsigned, args: [reg1, reg2, "$1"] }
                ];
            }
        },

        "addu": function (args) {
            return Insts.add(args, true);
        },

        "addi": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, imm16
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16 = Utils.Type.imm16(args[2]);
            var valid = reg1 && reg2 && (imm16 !== null);

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "addi", args: [reg1, reg2, imm16] }];
        },

        "addiu": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, imm16
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16 = Utils.Type.imm16(args[2]);
            var valid = reg1 && reg2 && (imm16 !== null);

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "addiu", args: [reg1, reg2, imm16] }];
        },

        "sub": function (args, unsigned) {
            var unsigned = unsigned ? "u" : "";

            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            // reg, reg, imm16
            // reg, reg, imm32
            var valid = false;
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            if (reg1 && reg2 && reg3) {
                valid = true; // reg reg reg
            } else {
                var imm16 = Utils.Type.imm16(args[2]);
                if (imm16 !== null) {
                    imm16 = imm16 * -1;
                    if (!Utils.Math.in_signed_range(imm16, 16)) {
                        imm16 = null;
                    }
                }
                var imm32 = Utils.Type.imm32(args[2]);
                if (reg1 && reg2 && (imm16 !== null || imm32 !== null)) {
                    valid = true;
                }
            }

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (reg3) {
                return [{ inst: "sub" + unsigned, args: [reg1, reg2, reg3] }];
            }

            if (imm16 !== null) {
                return [{ inst: "addi" + unsigned, args: [reg1, reg2, imm16] }];
            }

            if (imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: "sub" + unsigned, args: [reg1, reg2, "$1"] }
                ];
            }
        },

        "subu": function (args) {
            return Insts.sub(args, true);
        },

        "mult": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Correct args types?
            // reg, reg
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var valid = reg1 && reg2;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "mult", args: [reg1, reg2] }];
        },

        "multu": function (args) {
            // Don't diffrentiate from mult for now
            return Insts.mult(args);
        },

        "divu": function (args) {
            // Don't diffrentiate from div for now
            return Insts.div(args);
        },

        "mul": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            // reg, reg, imm16
            // reg, reg, imm32
            var valid = false;
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            if (reg1 && reg2 && reg3) {
                valid = true; // reg reg reg
            } else {
                var imm16 = Utils.Type.imm16(args[2]);
                var imm32 = Utils.Type.imm32(args[2]);
                if (reg1 && reg2 && (imm16 !== null || imm32 !== null)) {
                    valid = true;
                }
            }

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (reg3) {
                return [
                    { inst: "mult", args: [reg2, reg3] },
                    { inst: "mflo", args: [reg1] }
                ];
            }

            if (imm16 !== null) {
                return [
                    { inst: "addi", args: ["$1", "$0", imm16] },
                    { inst: "mult", args: [reg2, "$1"] },
                    { inst: "mflo", args: [reg1] }
                ];
            }

            if (imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: "mult", args: [reg2, "$1"] },
                    { inst: "mflo", args: [reg1] }
                ];
            }
        },

        "div": function (args) {
            // Correct args length?
            if (args.length > 3 || args.length < 2) {
                return null;
            }

            // Correct args types?
            // reg, reg
            // reg, reg, reg
            // reg, reg, imm16
            // reg, reg, imm32
            var valid = false;
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = null;
            if (args.length === 2) {
                if (reg1 && reg2) {
                    valid = true; // reg reg
                }
            } else {
                reg3 = Utils.Type.reg(args[2]);
                if (reg1 && reg2 && reg3) {
                    valid = true; // reg reg reg
                } else {
                    var imm16 = Utils.Type.imm16(args[2]);
                    var imm32 = Utils.Type.imm32(args[2]);
                    if (reg1 && reg2 && (imm16 !== null || imm32 !== null)) {
                        valid = true; // reg reg imm
                    }
                }
            }

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (args.length === 2) {
                return [ {inst: "div", args: [reg1, reg2] } ];
            } else {
                if (reg3) {
                    return [
                        { inst: "div", args: [reg2, reg3] },
                        { inst: "mflo", args: [reg1] }
                    ];
                }

                if (imm16 !== null) {
                    return [
                        { inst: "addi", args: ["$1", "$0", imm16] },
                        { inst: "div", args: [reg2, "$1"] },
                        { inst: "mflo", args: [reg1] }
                    ];
                }

                if (imm32 !== null) {
                    return [
                        { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                        { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                        { inst: "div", args: [reg2, "$1"] },
                        { inst: "mflo", args: [reg1] }
                    ];
                }
            }
        },

        "mfhi": function (args) {
            // Correct args length?
            if (args.length !== 1) {
                return null;
            }

            // Correct args types?
            // reg
            var reg1 = Utils.Type.reg(args[0]);
            if(!reg1) {
                return null;
            }

            // Return final instruction(s)
            return [{inst: "mfhi", args: [reg1] } ];
        },

        "mflo": function (args) {
            // Correct args length?
            if (args.length !== 1) {
                return null;
            }

            // Correct args types?
            // reg
            var reg1 = Utils.Type.reg(args[0]);
            if (!reg1) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "mflo", args: [reg1] }];
        },

        "lui": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Correct args types?
            // reg imm16
            var reg1 = Utils.Type.reg(args[0]);
            var imm16 = Utils.Type.imm16u(args[1]);
            var valid = reg1 && (imm16 !== null);

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [ { inst: "lui", args: [reg1, imm16] } ];
        },

        "and": function (args, final) {
            var final = final || "and";

            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            // reg, reg, imm16
            // reg, reg, imm32
            var valid = false;
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            if (reg1 && reg2 && reg3) {
                valid = true; // reg reg reg
            } else {
                var imm16 = Utils.Type.imm16u(args[2]);
                var imm32 = Utils.Type.imm32(args[2]);
                if (reg1 && reg2 && (imm16 !== null || imm32 !== null)) {
                    valid = true;
                }
            }

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (reg3) {
                return [{ inst: final, args: [reg1, reg2, reg3] }];
            }

            if (imm16 !== null) {
                return [{ inst: final + "i", args: [reg1, reg2, imm16] }];
            }

            if (imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: final, args: [reg1, reg2, "$1"] }
                ];
            }
        },

        "andi": function (args, final) {
            var final = final || "andi";

            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, imm16
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16 = Utils.Type.imm16u(args[2]);
            var valid = reg1 && reg2 && (imm16 !== null);

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: final, args: [reg1, reg2, imm16] }];
        },

        "or": function (args) {
            return Insts.and(args, "or");
        },

        "ori": function (args) {
            return Insts.andi(args, "ori");
        },

        "xor": function (args, final) {
            var final = final || "xor";

            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            var valid = reg1 && reg2 && reg3;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: final, args: [reg1, reg2, reg3] }];
        },

        "nor": function (args) {
            return Insts.xor(args, "nor");
        },

        "syscall": function (args) {
            if (args.length !== 0) {
                return null;
            }

            return [{ inst: "syscall", args: [] }];
        },

        "slt": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            // reg, reg, imm16
            // reg, reg, imm32
            var valid = false;
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            if (reg1 && reg2 && reg3) {
                valid = true; // reg reg reg
            } else {
                var imm16 = Utils.Type.imm16(args[2]);
                var imm32 = Utils.Type.imm32(args[2]);
                if (reg1 && reg2 && (imm16 !== null || imm32 !== null)) {
                    valid = true;
                }
            }

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (reg3) {
                return [{ inst: "slt", args: [reg1, reg2, reg3] }];
            }

            if (imm16 !== null) {
                return [{ inst: "slti", args: [reg1, reg2, imm16] }];
            }

            if (imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: "slt", args: [reg1, reg2, "$1"] }
                ];
            }
        },

        "slti": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, imm16
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16 = Utils.Type.imm16(args[2]);
            var valid = reg1 && reg2 && (imm16 !== null);

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "slti", args: [reg1, reg2, imm16] }];
        },

        "sll": function (args, final) {
            // Set final instruction
            final = final || "sll";

            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, imm16
            // reg, reg, reg
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            var imm16 = Utils.Type.imm16(args[2]);
            var valid = reg1 && reg2 && (imm16 !== null || reg3);

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (imm16 !== null) {
                return [{ inst: final, args: [reg1, reg2, imm16] }];
            } else {
                return [{ inst: final + "v", args: [reg1, reg2, reg3] }];
            }
            
        },

        "srl": function (args) {
            return Insts.sll(args, "srl");
        },

        "sllv": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            var valid = reg1 && reg2 && reg3;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "sllv", args: [reg1, reg2, reg3] }];
        },

        "srlv": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            var valid = reg1 && reg2 && reg3;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "srlv", args: [reg1, reg2, reg3] }];
        },

        "abs": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Correct args types?
            // reg, reg
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var valid = reg1 && reg2;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [
                { inst: "slt", args: ["$1", reg2, "$0"] },
                { inst: "add", args: [reg1, reg2, "$0"] },
                { inst: "beq", args: ["$1", "$0", 1] },
                { inst: "sub", args: [reg1, "$0", reg1] }
            ];
        },

        "rem": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            // reg, reg, imm16
            // reg, reg, imm32
            var valid = false;
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            if (reg1 && reg2 && reg3) {
                valid = true; // reg reg reg
            } else {
                var imm16 = Utils.Type.imm16(args[2]);
                var imm32 = Utils.Type.imm32(args[2]);
                if (reg1 && reg2 && (imm16 !== null || imm32 !== null)) {
                    valid = true;
                }
            }

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (reg3) {
                return [
                    { inst: "div", args: [reg2, reg3] },
                    { inst: "mfhi", args: [reg1] }
                ];
            }

            if (imm16 !== null) {
                return [
                    { inst: "addi", args: ["$1", "$0", imm16] },
                    { inst: "div", args: [reg2, "$1"] },
                    { inst: "mfhi", args: [reg1] }
                ];
            }

            if (imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: "div", args: [reg2, "$1"] },
                    { inst: "mfhi", args: [reg1] }
                ];
            }
        },

        "mod": function (args) {
            // This instruction is an alias for 'rem'
            return Insts.rem(args);
        },

        "move": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Correct args types?
            // reg, reg
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var valid = reg1 && reg2;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [ { inst: "add", args: [reg1, reg2, "$0"] } ];
        },

        "clear": function (args) {
            // Correct args length?
            if (args.length !== 1) {
                return null;
            }

            // Correct args types?
            // reg
            var reg1 = Utils.Type.reg(args[0]);

            // Fail if necessary
            if (!reg1) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "add", args: [reg1, "$0", "$0"] }];
        },

        "not": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Correct args types?
            // reg, reg
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var valid = reg1 && reg2;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "nor", args: [reg1, reg2, "$0"] }];
        },

        "li": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Correct args types?
            // reg, imm16
            // reg, imm32
            var reg1 = Utils.Type.reg(args[0]);
            var imm16 = Utils.Type.imm16(args[1]);
            var imm32 = Utils.Type.imm32(args[1]);
            var valid = reg1 && ((imm16 !== null) || (imm32 !== null));

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (imm16 !== null && Number(args[1]) >= 0) {
                return [ { inst: "ori", args: [reg1, "$0", imm16] } ];
            } else {
                return [
                    { inst: "lui", args: [reg1, Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: [reg1, reg1, Utils.Math.bottom_16(imm32)] }
                ];
            }
        },

        "la": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Correct args types?
            // reg, data_label
            var reg1 = Utils.Type.reg(args[0]);
            var label = Utils.Parser.is_label(args[1]);
            var valid = reg1 && label;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            // Labels will transformed in a later step
            return [
                { inst: "lui", args: [reg1, label] },
                { inst: "ori", args: [reg1, reg1, label] }
            ];
        },

        "lw": function (args, final) {
            // Set the final instruction
            var final = final || "lw";

            // Correct args length?
            if (args.length < 2 || args.length > 3) {
                return null;
            }

            // Correct args types?
            // reg, imm16, reg
            // reg, imm32, reg
            // reg, data_label, reg
            // reg, data_label
            // reg, imm32
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = null;
            var imm16 = Utils.Type.imm16(args[1]);
            var imm32 = Utils.Type.imm32(args[1]);
            var label = Utils.Parser.is_label(args[1]);
            var valid = false;
            if (args.length === 2) {
                if (reg1 && (label || (imm32 !== null))) {
                    valid = true;
                }
            } else {
                reg2 = Utils.Type.reg(args[2]);
                if (reg1 && reg2 && (imm32 !== null || imm16 !== null || label)) {
                    valid = true;
                }
            }

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            // Labels will transformed in a later step
            if (args.length === 2 || reg2 === "$0") {
                if (label) {
                    // reg, data_label
                    return [
                        { inst: "lui", args: ["$1", label] },
                        { inst: "ori", args: ["$1", "$1", label] },
                        { inst: final, args: [reg1, 0, "$1"] }
                    ];
                } else {
                    // reg, imm32
                    return [
                        { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                        { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                        { inst: final, args: [reg1, 0, "$1"] }
                    ];
                }
            } else {
                if (imm16 !== null) {
                    // reg, imm16, reg
                    return [{inst: final, args: [reg1, imm16, reg2]}];
                }

                if (imm32 !== null) {
                    // reg, imm32, reg
                    return [
                        { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                        { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                        { inst: "add", args: ["$1", "$1", reg2] },
                        { inst: final, args: [reg1, 0, "$1"] }
                    ];
                }

                if (label) {
                    // reg, data_label, reg
                    return [
                        { inst: "lui", args: ["$1", label] },
                        { inst: "ori", args: ["$1", "$1", label] },
                        { inst: "add", args: ["$1", "$1", reg2] },
                        { inst: final, args: [reg1, 0, "$1"] }
                    ];
                }
            }
        },

        "lh": function (args) {
            return Insts.lw(args, "lh");
        },

        "lhu": function (args) {
            return Insts.lw(args, "lhu");
        },

        "lb": function (args) {
            return Insts.lw(args, "lb");
        },

        "lbu": function (args) {
            return Insts.lw(args, "lbu");
        },

        "sw": function (args) {
            return Insts.lw(args, "sw");
        },

        "sh": function (args) {
            return Insts.lw(args, "sh");
        },

        "sb": function (args) {
            return Insts.lw(args, "sb");
        },

        "jr": function (args) {
            // Correct args length?
            if (args.length !== 1) {
                return null;
            }

            // Correct args types?
            // reg
            var reg1 = Utils.Type.reg(args[0]);

            // Fail if necessary
            if (!reg1) {
                return null;
            }

            // Return final instruction(s)
            return [{ inst: "jr", args: [reg1] }];
        },

        "jal": function (args, final) {
            // Set final instruction
            final = final || "jal";

            // Correct args length?
            if (args.length !== 1) {
                return null;
            }

            // Correct args types?
            // imm26
            // text_label
            var imm26 = Utils.Type.imm26(args[0]);
            var label = Utils.Parser.is_label(args[0]);
            var valid = (imm26 !== null) || label;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (label) {
                return [{ inst: final, args: [label] }];
            }

            if (imm26) {
                return [{ inst: final, args: [imm26] }];
            }
        },

        "j": function (args) {
            return Insts.jal(args, "j");
        },

        "bne": function (args, final) {
            // Set the final instruction
            final = final || "bne";

            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg reg imm16
            // reg reg text_label
            // reg imm16 text_label
            // reg imm16 imm16
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16_cmp = Utils.Type.imm16(args[1]);
            var imm16_offset = Utils.Type.imm16(args[2]);
            var label = Utils.Parser.is_label(args[2]);
            var valid = false;
            if (reg1 && (reg2 || (imm16_cmp !== null)) && ((imm16_offset !== null) || label)) {
                valid = true;
            }

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (reg2) {
                if (imm16_offset !== null) {
                    return [{ inst: final, args: [reg1, reg2, imm16_offset] }];
                } else {
                    return [{ inst: final, args: [reg1, reg2, label] }];
                }
            } else {
                if (imm16_offset !== null) {
                    return [
                        { inst: "addi", args: ["$1", "$0", imm16_cmp] },
                        { inst: final, args: [reg1, "$1", imm16_offset] }
                    ];
                } else {
                    return [
                        { inst: "addi", args: ["$1", "$0", imm16_cmp] },
                        { inst: final, args: [reg1, "$1", label] }
                    ];
                }
            }
        },

        "beq": function (args) {
            return Insts.bne(args, "beq");
        },

        "bgt": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, text_label
            // reg, imm16, text_label
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16 = Utils.Type.imm16(args[1]);
            imm16 = (imm16 === null) ? null : imm16 + 1; // +1 is IMPORTANT
            var label = Utils.Parser.is_label(args[2]);
            var valid = reg1 && (reg2 || (imm16 !== null && Utils.Math.in_signed_range(imm16, 16))) && label;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            var first;
            var rest;
            if (imm16 !== null) {
                first = { inst: "slti", args: ["$1", reg1, imm16] };
                rest = Insts.bne(["$1", "$0", label], "beq");
            } else {
                first = { inst: "slt", args: ["$1", reg2, reg1] };
                rest = Insts.bne(["$1", "$0", label], "bne");
            }

            rest.splice(0, 0, first);
            return rest;
        },

        "blt": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, text_label
            // reg, imm16, text_label
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16 = Utils.Type.imm16(args[1]);
            var label = Utils.Parser.is_label(args[2]);
            var valid = reg1 && (reg2 || (imm16 !== null)) && label;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            var first;
            var rest;
            if (imm16 !== null) {
                first = { inst: "slti", args: ["$1", reg1, imm16] };
                rest = Insts.bne(["$1", "$0", label], "bne");
            } else {
                first = { inst: "slt", args: ["$1", reg1, reg2] };
                rest = Insts.bne(["$1", "$0", label], "bne");
            }

            rest.splice(0, 0, first);
            return rest;
        },

        "bge": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, text_label
            // reg, imm16, text_label
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16 = Utils.Type.imm16(args[1]);
            var label = Utils.Parser.is_label(args[2]);
            var valid = reg1 && (reg2 || (imm16 !== null)) && label;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            var first;
            var rest;
            if (imm16 !== null) {
                first = { inst: "slti", args: ["$1", reg1, imm16] };
                rest = Insts.bne(["$1", "$0", label], "beq");
            } else {
                first = { inst: "slt", args: ["$1", reg1, reg2] };
                rest = Insts.bne(["$1", "$0", label], "beq");
            }

            rest.splice(0, 0, first);
            return rest;
        },

        "ble": function (args) {
            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, text_label
            // reg, imm16, text_label
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var imm16 = Utils.Type.imm16(args[1]);
            imm16 = (imm16 === null) ? null : imm16 + 1; // +1 is IMPORTANT
            var label = Utils.Parser.is_label(args[2]);
            var valid = reg1 && (reg2 || (imm16 !== null && Utils.Math.in_signed_range(imm16, 16))) && label;

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            var first;
            var rest;
            if (imm16 !== null) {
                first = { inst: "slti", args: ["$1", reg1, imm16] };
                rest = Insts.bne(["$1", "$0", label], "bne");
            } else {
                first = { inst: "slt", args: ["$1", reg2, reg1] };
                rest = Insts.bne(["$1", "$0", label], "beq");
            }

            rest.splice(0, 0, first);
            return rest;
        }
    };

    // Assign a base address to each line and replace labels with values
    var gather_labels = function (raw, data_labels) {
        var text_labels = {};
        var current_address = base_address;

        // Assign a base address to each line
        for (var i = 0; i < raw.length; i++) {
            raw[i].base = current_address;
            var space = 4 * raw[i].instructions.length;
            raw[i].space = space;
            current_address += space;

            // Are we too big?
            if (current_address > max_address) {
                // FAIL
                throw Utils.get_error(7, ["text",raw[i].line]);
            }
        }

        // Gather all the labels
        for (var i = 0; i < raw.length; i++) {
            var label = raw[i].label;

            if (label) {
                // Make sure this label declaration is unique
                if (Utils.get(text_labels, label)) {
                    // FAIL
                    throw Utils.get_error(9, [label, raw[i].line]);
                }

                // Point the label to this instruction
                text_labels[label] = raw[i].base;
            }
        }

        // Replace all instances of labels in instructions
        for (var i = 0; i < raw.length; i++) {
            raw[i].instructions = subst_label(raw[i], text_labels, data_labels);
        }

        // Require a 'main' label
        if (!text_labels["main"]) {
            // FAIL
            throw Utils.get_error(12,[]);
        }

        // Return the updated data segment and labels
        return { text: raw, text_labels: text_labels };
    };

    // Performs a substitution for a label in an instructions
    var subst_label = function (line, text_labels, data_labels) {
        // lui (arg 2) -> top_16(label_addr) // data
        // ori (arg 3) -> bottom_16(label_addr) // data
        // jal (arg 1) -> imm26(label_addr) // text
        // j (arg 1) -> imm26(label_addr) // text
        // beq (arg 3) -> offset(base, label_addr) // text
        // bne (arg 3) -> offset(base, label_addr) // text
        var current = line.instructions;

        for (var i = 0; i < current.length; i++) {
            if (current[i].inst === "lui") {
                // Data label at args[1]?
                var label = Utils.Parser.is_label(current[i].args[1]);
                if (!label) {
                    continue;
                }

                // Fail if unmatched label
                var val_or_null = Utils.get(data_labels, label);
                if (val_or_null === null) {
                    // FAIL
                    throw Utils.get_error(8, [label, line.line]);
                }

                // Substitute if matched
                current[i].args[1] = Utils.Math.top_16(val_or_null);
            }

            if (current[i].inst === "ori") {
                // Data label at args[2]?
                var label = Utils.Parser.is_label(current[i].args[2]);
                if (!label) {
                    continue;
                }

                // Fail if unmatched label
                var val_or_null = Utils.get(data_labels, label);
                if (val_or_null === null) {
                    // FAIL
                    throw Utils.get_error(8, [label, line.line]);
                }

                // Substitute if matched
                current[i].args[2] = Utils.Math.bottom_16(val_or_null);
            }

            if (current[i].inst === "jal" || current[i].inst === "j") {
                // Text label at args[0]?
                var label = Utils.Parser.is_label(current[i].args[0]);
                if (!label) {
                    continue;
                }

                // Fail if unmatched label
                var val_or_null = Utils.get(text_labels, label);
                if (val_or_null === null) {
                    // FAIL
                    throw Utils.get_error(8, [label, line.line]);
                }

                // Substitute if matched
                current[i].args[0] = (val_or_null & 0xFFFFFFC) >>> 2;
            }

            if (current[i].inst === "bne" || current[i].inst === "beq") {
                // Text label at args[2]?
                var label = Utils.Parser.is_label(current[i].args[2]);
                if (!label) {
                    continue;
                }

                // Fail if unmatched label
                var val_or_null = Utils.get(text_labels, label);
                if (val_or_null === null) {
                    // FAIL
                    throw Utils.get_error(8, [label, line.line]);
                }

                // Substitute if matched
                current[i].args[2] = Math.floor(((val_or_null - (line.base + i)) - 4) / 4);
            }
        }

        return current;
    };

    // Create the final PC map
    var finalize = function (raw) {
        var result = {};

        var biggest = 0;

        for (var i = 0; i < raw.length; i++) {
            var addr = raw[i].base;
            for (var j = 0; j < raw[i].instructions.length; j++) {
                var hex = Utils.Math.to_hex(addr + (j * 4));

                result[hex] = {
                    inst: raw[i].instructions[j].inst,
                    args: raw[i].instructions[j].args,
                    raw: raw[i]
                };

                biggest = addr + (j * 4);
            }
        }

        return {
            segment: result,
            end_addr: biggest + 4
        };
    };

    var parse = function (raw_insts, data_labels) {
        // TEMP
        var validated = validate(raw_insts);
        var labeled = gather_labels(validated, data_labels);
        var finalized = finalize(labeled.text);
        return {
            segment: finalized.segment,
            labels: labeled.text_labels,
            raw: labeled.text,
            end_addr: finalized.end_addr
        };
    };

    // Return out the interface
    return {
        parse: parse,
        base_address: base_address,
        max_address: max_address
    };
})();
    
    // Module for parsing a data segment
var DataParser = (function () {
    // Constants
    var base_address = Utils.Parser.const_to_val("0x10000000");
    var max_address = Utils.Parser.const_to_val("0x10100000");
    var base_stack = Utils.Parser.const_to_val("0x7fff0000");
    var max_stack = Utils.Parser.const_to_val("0x80000000");

    // Each line must have a label (optional), type, and 1 or more arguments of that type/labels
    // This function will extract the label, type, and args
    // Then, it will verify them.
    var verify = function (raw) {

        // Split the line up
        for (var i = 0; i < raw.length; i++) {
            // Split based on spaces
            var current = raw[i].text.split(" ");

            // Do we have a label? If so, consume it.
            var label_or_null = Utils.Parser.is_label_dec(current[0]);
            if (label_or_null) {
                raw[i].label = label_or_null;
                current = current.slice(1);
            } else {
                raw[i].label = null;
            }

            // Then, we MUST have a type.
            var type_or_null = Utils.Parser.is_type(current[0]);
            if (type_or_null) {
                raw[i].type = type_or_null;
                current = current.slice(1);
            } else {
                // FAIL
                throw Utils.get_error(4, [raw[i].line]);
            }

            // Then, we MUST have 1 or more arguments
            if (current.length < 1) {
                // FAIL
                throw Utils.get_error(6, [raw[i].type, raw[i].line]);
            } else {
                raw[i].args = current;
            }

            // Unescape any strings in the original text
            raw[i].text = Utils.Parser.unescape_string(raw[i].text);
        }

        // Validate arguments
        for (var i = 0; i < raw.length; i++) {
            var current = raw[i].args;
            var type = raw[i].type;

            // Certain types can only have one argument
            if (type === "space" || type === "align") {
                if (current.length > 1) {
                    throw Utils.get_error(5, [current[1], type, raw[i].line]);
                }
            }

            for (var j = 0; j < current.length; j++) {
                // Hand off to validation helper
                var validation_result = Utils.Type[type](current[j]);
                if (validation_result !== null) {
                    current[j] = validation_result;
                } else {
                    throw Utils.get_error(5, [current[j], type, raw[i].line]);
                }
            }
        }

        // Return the result
        return raw;
    };

    // Find label declarations and replace appropriately
    // NOTE: Data must have been validated
    var gather_labels = function (raw) {
        var labels = {};
        var current_address = base_address;

        var line_to_size = function (prev, line) {
            if (line.type === "word") {
                var pre_padding = 4 * line.args.length;
                var mod = prev % 4;
                if (mod === 0) {
                    return pre_padding;
                } else {
                    return pre_padding + (4 - mod);
                }
            }

            if (line.type === "half") {
                return 2 * line.args.length;
                var mod = prev % 2;
                if (mod === 0) {
                    return pre_padding;
                } else {
                    return pre_padding + (2 - mod);
                }
            }

            if (line.type === "byte") {
                return line.args.length;
            }

            if (line.type === "ascii" || line.type === "asciiz") {
                var length = 0;
                for (var i = 0; i < line.args.length; i++) {
                    length += line.args[i].length;
                }
                return length;
            }

            if (line.type === "space") {
                return line.args[0];
            }

            if (line.type === "align") {
                var modulus = Math.pow(2, line.args[0]);
                var mod = prev % modulus;
                if (mod == 0) {
                    return 0;
                } else {
                    return modulus - mod;
                }
            }

            return null;
        };

        // Assign a base address to each line
        for (var i = 0; i < raw.length; i++) {
            raw[i].base = current_address;
            var space = line_to_size(current_address, raw[i]);
            raw[i].space = space;
            current_address += space;

            // Are we too big?
            if (current_address > max_address) {
                // FAIL
                throw Utils.get_error(7, ["data",raw[i].line]);
            }
        }

        // Gather all the labels
        for (var i = 0; i < raw.length; i++) {
            var label = raw[i].label;

            if (label) {
                // Make sure this label declaration is unique
                if (Utils.get(labels, label)) {
                    // FAIL
                    throw Utils.get_error(9, [label, raw[i].line]);
                }

                // Make sure the label points to the content, not padding
                var label_addr = raw[i].base;
                if (raw[i].type === "word") {
                    label_addr += raw[i].space % 4;
                }
                if (raw[i].type === "half") {
                    label_addr += raw[i].space % 2;
                }
                labels[label] = label_addr;
            }
        }

        // Replace all instances of labels in words with the address
        for (var i = 0; i < raw.length; i++) {
            var current = raw[i].args;
            if (raw[i].type === "word") {
                for (var j = 0; j < current.length; j++) {
                    if (Utils.Parser.is_label(current[j])) {
                        var match = Utils.get(labels, current[j]);
                        if (match) {
                            current[j] = match;
                        } else {
                            // FAIL
                            throw Utils.get_error(8, [current[j], raw[i].line]);
                        }
                    }
                }
            }
        }

        // Return the updated data segment and labels
        return { data: raw, labels: labels };
    };

    // Convert preliminary data to the final data
    var to_final = function (raw) {
        var final = {};
        var address = base_address;

        for (var i = 0; i < raw.length; i++) {
            var type = raw[i].type;
            var args = raw[i].args;
            var base = raw[i].base;
            var space = raw[i].space;

            // Fill any padding
            if (type === "word" || type === "half") {
                var modulus = 4;
                if (type === "half") {
                    modulus = 2;
                }

                var padding = space % modulus;
                for (var j = 0; j < padding; j++) {
                    final[Utils.Math.to_hex(address)] = 0;
                    address++;
                }
            }

            // Fill with values
            if (type === "space" || type === "align") {
                // We need space 0's
                for (var j = 0; j < space; j++) {
                    final[Utils.Math.to_hex(address)] = 0;
                    address++;
                }
            }

            if (type === "word") {
                // Little endianize each word
                for (var j = 0; j < args.length; j++) {
                    var bytes = Utils.Math.split_to_bytes(args[j], 4);

                    for (var k = 0; k < bytes.length; k++) {
                        final[Utils.Math.to_hex(address)] = bytes[k];
                        address++;
                    }
                }
            }

            if (type === "half") {
                // Little endianize each half
                for (var j = 0; j < args.length; j++) {
                    var bytes = Utils.Math.split_to_bytes(args[j], 2);

                    for (var k = 0; k < bytes.length; k++) {
                        final[Utils.Math.to_hex(address)] = bytes[k];
                        address++;
                    }
                }
            }

            if (type === "byte") {
                for (var j = 0; j < args.length; j++) {
                    final[Utils.Math.to_hex(address)] = new Number(args[j]);
                    address++;
                }
            }

            if (type === "ascii" || type === "asciiz") {
                for (var j = 0; j < args.length; j++) {
                    for (var k = 0; k < args[j].length; k++) {
                        final[Utils.Math.to_hex(address)] = args[j].charCodeAt(k);
                        address++;
                    }
                }
            }
        }

        return final;
    };

    // Chains together the above to complete a data segment parse
    var parse = function (raw) {
        var post_validation = verify(raw);
        var post_label = gather_labels(post_validation);

        // Function for resetting the segment to tis original state (simply redo finalization)
        var final_segment = function () {
            var result = to_final(post_label.data);
            return result;
        };


        return {segment: final_segment, labels: post_label.labels};
    };

    // Creates a byte-addressed stack segment, initalized ot zero.
    var create_stack = function () {
        var stack = {};

        var current = base_stack;

        while (current <= max_stack) {
            stack[Utils.Math.to_hex(current)] = 0;
            current += 1;
        }

        return stack;
    };

    // Return out the interface
    return {
        parse: parse,
        base_address: base_address,
        max_address: max_address,
        base_stack: base_stack,
        max_stack: max_stack,
        create_stack: create_stack
    };
})();
    
    var Parser = (function () {
    // Constants
    var regex_useless = /;|,|\r|\v|\f|(^\s*\n)|^\s+/gim;
    var regex_spaces = /\ \ +|\t+/gmi;
    var regex_comment = /^(#|\/\/)(.*)/im;
    var regex_multicomment = /\/\*((.|\n)*)\*\//gim;
    var regex_linelabel = /^[a-zA-Z_][a-zA-Z0-9_]*:$/im;
    var regex_constant = /^([a-zA-Z_][a-zA-Z0-9_]*)\ ?=\ ?(.+)/im;

    // Cleanup: Removes whitespace and comments, aligns labels.
    // Results in line #/line/comment pairs
    var cleanup = function (input) {
        // Remove multiline comments /* ... */
        input = input.replace(regex_multicomment, "");

        // Split stuff up
        var split = input.split("\n");
        var result = [];

        // Create the objects (after some cleanup)
        for (var i = 0; i < split.length; i++) {
            // ignore global directives for now
            split[i] = split[i].replace(/\.globl\ .*/, "");

            // Remove full-line comments
            if (regex_comment.test(split[i])) {
                split[i] = "";
            }

            // Split the comment from the body
            var raw_comment = Utils.Parser.extract_comment(split[i]);

            // Remove whitespace from the line
            raw_comment.without = raw_comment.without.replace(regex_useless, "");
            while (regex_spaces.test(raw_comment.without)) {
                raw_comment.without = raw_comment.without.replace(regex_spaces, " ");
            }
            raw_comment.without = raw_comment.without.replace(/(.*)\s+$/im, "$1");

            // Escape strings (for now, we'll unescape later)
            raw_comment.without = Utils.Parser.escape_strings(raw_comment.without);

            // Are we blank?
            if (raw_comment.without === "") {
                continue;
            }        

            result.push({ line: (i + 1), text: raw_comment.without, comment: raw_comment.comment });
        }

        // inline labels with the line they are labeling
        for (var i = 0; i < result.length - 1; i++) {
            if (regex_linelabel.test(result[i].text)) {
                result[i + 1].text = result[i].text + " " + result[i + 1].text;
                result[i].text = "";
            }
        }

        // postprocess and return the result
        var new_result = [];
        for (var i = 0; i < result.length; i++) {
            if (result[i].text !== "") {
                new_result.push(result[i]);
            }
        }

        return new_result;
    };

    // ParseConstants: Parses and removes constants, then applies various substitutions
    // Note: Input must have been 'cleaned up'.
    var parse_constants = function (input) {
        var constants = {};

        for (var i = 0; i < input.length; i++) {
            if (regex_constant.test(input[i].text)) {
                var name = input[i].text.replace(regex_constant, "$1");
                var value = Utils.Parser.const_to_val(input[i].text.replace(regex_constant, "$2"));
                if (value === null) {
                    // FAIL
                    throw Utils.get_error(0, [input[i].text, input[i].line]);
                }
                constants[name] = value;
                input[i].text = "";
            }
        }

        // postprocess and return the result
        var result = [];
        for (var i = 0; i < input.length; i++) {
            if (input[i].text !== "") {
                result.push(input[i]);
            }
        }

        // apply the substituions
        result = subst_constants(result, constants);

        return {text: result, constants: constants};
    };

    // Substitues constants for their values in a string.
    // Also handles register converstions from named to numbered
    var subst_constants = function (input, constants) {
        var regs = {
            "$zero": "$0",
            "$r0": "$0",
            "$at": "$1",
            "$v0": "$2",
            "$v1": "$3",
            "$a0": "$4",
            "$a1": "$5",
            "$a2": "$6",
            "$a3": "$7",
            "$t0": "$8",
            "$t1": "$9",
            "$t2": "$10",
            "$t3": "$11",
            "$t4": "$12",
            "$t5": "$13",
            "$t6": "$14",
            "$t7": "$15",
            "$s0": "$16",
            "$s1": "$17",
            "$s2": "$18",
            "$s3": "$19",
            "$s4": "$20",
            "$s5": "$21",
            "$s6": "$22",
            "$s7": "$23",
            "$t8": "$24",
            "$t9": "$25",
            "$k0": "$26",
            "$k1": "$27",
            "$gp": "$28",
            "$sp": "$29",
            "$fp": "$30",
            "$ra": "$31"
        };

        for (var i = 0; i < input.length; i++) {
            var current = input[i].text.split(" ");

            for (var j = 0; j < current.length; j++) {
                var prop = current[j];

                // Is this an offset?
                var offset = Utils.Parser.parse_offset(prop);
                if (offset) {
                    if (Utils.get(constants, offset.offset) !== null) {
                        offset.offset = constants[offset.offset].toString();
                    }

                    if (Utils.get(regs, offset.reg.toLowerCase()) !== null) {
                        offset.reg = regs[offset.reg.toLowerCase()];
                    }

                    // Convert the offset into two arguments (by separating with a space)
                    current[j] = offset.offset + " " + offset.reg;
                } else {
                    // Handle constants
                    if (Utils.get(constants,prop) !== null) {
                        current[j] = constants[prop].toString();
                    }

                    // Handle registers
                    if (Utils.get(regs,prop.toLowerCase()) !== null) {
                        current[j] = regs[prop.toLowerCase()];
                    }
                }
            }

            input[i].text = current.join(" ");
        }

        return input;
    };

    // Segment: Splits the assembly into the various segments, and verifies them
    // Note: Input should have been cleaned up and had constants removed
    var segment = function (input) {
        var hasData = false;
        var regexp_data = /^\.data$/gim;
        var regexp_text = /^\.text$/gim;

        var joined = Utils.Parser.join_by_prop(input, "text", "\n");

        // Verify <= 1 data segments.
        if (Utils.Parser.apply_regex(regexp_data, joined).length > 0) {
            hasData = true;

            if (Utils.Parser.apply_regex(regexp_data, joined).length > 1) {
                // FAIL
                throw Utils.get_error(1);
            }
        }

        // Verify exactly 1 text segment
        if (Utils.Parser.apply_regex(regexp_text, joined).length !== 1) {
            // FAIL
            throw Utils.get_error(2);
        }

        // Verify data (if any) comes before text
        if(hasData && joined.indexOf(".data") > 0) {
            // FAIL
            throw Utils.get_error(3);
        }

        // If there is not data, .text should be on the first line.
        if(!hasData && joined.indexOf(".text") > 0) {
            // FAIL
            throw Utils.get_error(3);
        }

        // Remove .data and .text directives, split into two arrays, and return.
        var data = [];
        var text = [];

        var text_index = -1;
        for (var i = 0; i < input.length; i++) {
            if (input[i].text === ".text") {
                text_index = i;
                break;
            }
        }

        data = input.slice(1, text_index);
        text = input.slice(text_index + 1, input.length);

        return {data: data, text: text};
    };

    // Parse: Performs a full parse into executable data and text segments
    // Note: This makes use of cleanup, parse_constants, and segment
    var parse = function (input) {
        try {
            // Start the chain
            var cleanup_result = cleanup(input);
            var constant_result = parse_constants(cleanup_result);
            var segment_result = segment(constant_result.text);
            
            // Parse the data
            var data_result = DataParser.parse(segment_result.data);
            var text_result = TextParser.parse(segment_result.text, data_result.labels);

            return {
                error: false,
                constants: constant_result.constants,
                data: data_result,
                text: text_result
            };
        } catch (e) {
            // Something went wrong! :(
            e.error = true;
            return e;
        }
    };

    // Return out the interface
    return {
        cleanup: cleanup,
        parse_constants: parse_constants,
        segment: segment,
        parse: parse
    };
})();
    
    // Returns an interpreter instance
var Runtime = (function () {
    // Setup:
    // - Register hash table: PC, HI, LO, $0-31
    // - Create a new interpeter object
    // - Initalize $ra to a special address
    // - Create a stack segment, point $sp to its beginning.
    // - Match PC to the main label
    // - Return this interpreter object
    // Interpretation:
    // - For each instruction:
    // -- Load the instruction at the PC value:
    // --- Error if PC % 4 !== 0
    // --- Exit if we are one instruction past the end of the text segment
    // --- Exit if we are one instruction before text segment (returned from main)
    // -- Run the mini-program associated with that instructions
    // -- Interpter can run for x cycles, or until error/exit.

    // CONSTANTS
    var cycle_limit = 1000000; // Max number of instructions to run

    // RETURNS A NEW INSTANCE OF AN INTERPRETER
    var create = function (data, text) {
        // Counts how many instructions have been executed
        var cycles = 0;

        // Have we exited?
        var has_exited = false;

        // Do we have an error?
        var error = null;

        // Output for syscalls
        var output = "";

        // A reference to the current raw instruction (or null)
        // Useful for debugging and error messages.
        var current_inst = null;

        // The registers
        var registers = {
            "PC": 0,
            "HI": 0,
            "LO": 0,
            "$0": 0,
            "$1": 0,
            "$2": 0,
            "$3": 0,
            "$4": 0,
            "$5": 0,
            "$6": 0,
            "$7": 0,
            "$8": 0,
            "$9": 0,
            "$10": 0,
            "$11": 0,
            "$12": 0,
            "$13": 0,
            "$14": 0,
            "$15": 0,
            "$16": 0,
            "$17": 0,
            "$18": 0,
            "$19": 0,
            "$20": 0,
            "$21": 0,
            "$22": 0,
            "$23": 0,
            "$24": 0,
            "$25": 0,
            "$26": 0,
            "$27": 0,
            "$28": 0,
            "$29": 0,
            "$30": 0,
            "$31": 0
        };

        // The stack. Will be created by reset().
        var stack = null;

        // The data segment. Will be created by reset from 'data'.
        var data_segment = null;

        // Safely writes a value to a register
        var write_register = function (reg, value) {
            registers[reg] = Utils.Math.to_unsigned(value, 32);
        };

        // Mini-program that executes a single instruction.
        var programs = {
            "lui": function (args) {
                var dest = args[0];
                var imm = Utils.Math.to_unsigned(args[1], 16);

                write_register(dest, imm << 16);

                return { set_PC: false };
            },

            "ori": function (args) {
                var dest = args[0];
                var reg = args[1];
                var imm = Utils.Math.to_unsigned(args[2], 16);

                write_register(dest, registers[reg] | imm);

                return { set_PC: false };
            },

            "addi": function (args) {
                var dest = args[0];
                var reg = args[1];
                var imm = args[2];

                var signed_reg = Utils.Math.to_signed(registers[reg], 32);
                var signed_imm = Utils.Math.to_signed(imm, 16);
                var sum = signed_reg + signed_imm;

                // TODO: Throw an exception on overflow

                write_register(dest, signed_reg + signed_imm);

                return { set_PC: false };
            },

            "addiu": function (args) {
                // Just do addi for now
                return programd.addi(args);
            },

            "add": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                var signed_reg1 = Utils.Math.to_signed(registers[reg1], 32);
                var signed_reg2 = Utils.Math.to_signed(registers[reg2], 32);
                var sum = signed_reg1 + signed_reg2;

                // TODO: Throw an exception on overflow

                write_register(dest, sum);

                return { set_PC: false };
            },

            "addu": function (args) {
                // Just do an add for now
                return programs.add(args);
            },

            "sub": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                var signed_reg1 = Utils.Math.to_signed(registers[reg1], 32);
                var signed_reg2 = Utils.Math.to_signed(registers[reg2], 32);
                var sub = signed_reg1 - signed_reg2;

                // TODO: Throw an exception on overflow

                write_register(dest, sub);

                return { set_PC: false };
            },

            "subu": function (args) {
                // Just do a sub for now
                return programs.sub(args);
            },

            "mult": function (args) {
                var reg1 = args[0];
                var reg2 = args[1];

                var signed_reg1 = Utils.Math.to_signed(registers[reg1], 32);
                var signed_reg2 = Utils.Math.to_signed(registers[reg2], 32);

                var product = signed_reg1 * signed_reg2;
                var hi = 0; // FOR NOW
                // TODO: Figure out how to get the actual 'hi' value in javascript.
                var lo = product & 0xFFFFFFFF;

                write_register("HI", hi);
                write_register("LO", lo);

                return { set_PC: false };
            },

            "mflo": function (args) {
                var dest = args[0];

                write_register(dest, registers["LO"]);

                return { set_PC: false };
            },

            "mfhi": function (args) {
                var dest = args[0];

                write_register(dest, registers["HI"]);

                return { set_PC: false };
            },

            "div": function (args) {
                var reg1 = args[0];
                var reg2 = args[1];

                var signed_reg1 = Utils.Math.to_signed(registers[reg1], 32);
                var signed_reg2 = Utils.Math.to_signed(registers[reg2], 32);

                if (signed_reg2 === 0) {
                    // FAIL
                    throw Utils.get_error(18, [current_inst.line]);
                }

                var hi = signed_reg1 % signed_reg2;
                var div = signed_reg1 / signed_reg2;
                var lo = div >= 0 ? Math.floor(div) : Math.ceil(div);

                write_register("HI", hi);
                write_register("LO", lo);

                return { set_PC: false };
            },

            "and": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                write_register(dest, registers[reg1] & registers[reg2]);

                return { set_PC: false };
            },

            "or": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                write_register(dest, registers[reg1] | registers[reg2]);

                return { set_PC: false };
            },

            "andi": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var imm = args[2];
                var unsigned_imm = Utils.Math.to_unsigned(imm, 16);

                write_register(dest, registers[reg1] & unsigned_imm);

                return { set_PC: false };
            },

            "xor": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                write_register(dest, registers[reg1] ^ registers[reg2]);

                return { set_PC: false };
            },

            "nor": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                write_register(dest, ~(registers[reg1] | registers[reg2]));

                return { set_PC: false };
            },

            "slt": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                var signed_reg1 = Utils.Math.to_signed(registers[reg1], 32);
                var signed_reg2 = Utils.Math.to_signed(registers[reg2], 32);

                write_register(dest, (signed_reg1 < signed_reg2) ? 1 : 0);

                return { set_PC: false };
            },

            "slti": function (args) {
                var dest = args[0];
                var reg = args[1];
                var imm = args[2];

                var signed_reg = Utils.Math.to_signed(registers[reg], 32);
                var signed_imm = Utils.Math.to_signed(imm, 16);

                write_register(dest, (signed_reg < signed_imm) ? 1 : 0);

                return { set_PC: false };
            },

            "sll": function (args) {
                var dest = args[0];
                var reg = args[1];
                var imm = args[2];

                var unsigned_reg = Utils.Math.to_unsigned(registers[reg], 32);
                var unsigned_imm = Utils.Math.to_unsigned(imm, 16);

                write_register(dest, unsigned_reg << unsigned_imm);

                return { set_PC: false };
            },

            "srl": function (args) {
                var dest = args[0];
                var reg = args[1];
                var imm = args[2];

                var unsigned_reg = Utils.Math.to_unsigned(registers[reg], 32);
                var unsigned_imm = Utils.Math.to_unsigned(imm, 16);

                write_register(dest, unsigned_reg >>> unsigned_imm);

                return { set_PC: false };
            },

            "sllv": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                var unsigned_reg1 = Utils.Math.to_unsigned(registers[reg1], 32);
                var unsigned_reg2 = Utils.Math.to_unsigned(registers[reg2], 32);

                write_register(dest, unsigned_reg1 << unsigned_reg2);

                return { set_PC: false };
            },

            "srlv": function (args) {
                var dest = args[0];
                var reg1 = args[1];
                var reg2 = args[2];

                var unsigned_reg1 = Utils.Math.to_unsigned(registers[reg1], 32);
                var unsigned_reg2 = Utils.Math.to_unsigned(registers[reg2], 32);

                write_register(dest, unsigned_reg1 >>> unsigned_reg2);

                return { set_PC: false };
            },

            "jr": function (args) {
                return { set_PC: registers[args[0]] };
            },

            "j": function (args) {
                var val = args[0];
                var addr = (registers["PC"] & 0xF0000000) | (val << 2);

                return { set_PC: addr };
            },

            "jal": function (args) {
                var val = args[0];
                var addr = (registers["PC"] & 0xF0000000) | (val << 2);

                write_register("$31", registers["PC"] + 4);

                return { set_PC: addr };
            },

            "sw": function (args, bits) {
                bits = bits || 4;

                var src = args[0];
                var offset = args[1];
                var reg = args[2];

                src = Utils.Math.to_unsigned(registers[src], 32);
                reg = Utils.Math.to_unsigned(registers[reg], 32);
                offset = Utils.Math.to_signed(offset, 16);

                Memory.write(src, offset + reg, bits);

                return { set_PC: false };
            },

            "sh": function (args) {
                return programs.sw(args, 2);
            },

            "sb": function (args) {
                return programs.sw(args, 1);
            },

            "lw": function (args) {
                var dest = args[0];
                var offset = args[1];
                var reg = args[2];

                reg = Utils.Math.to_unsigned(registers[reg], 32);
                offset = Utils.Math.to_signed(offset, 16);

                var value = Memory.read(offset + reg, 4);
                write_register(dest, value);

                return { set_PC: false };
            },

            "lh": function (args) {
                var dest = args[0];
                var offset = args[1];
                var reg = args[2];

                reg = Utils.Math.to_unsigned(registers[reg], 32);
                offset = Utils.Math.to_signed(offset, 16);

                var value = Memory.read(offset + reg, 2);
                value = Utils.Math.to_signed(value, 16); // Sign extend
                write_register(dest, value);

                return { set_PC: false };
            },

            "lhu": function (args) {
                var dest = args[0];
                var offset = args[1];
                var reg = args[2];

                reg = Utils.Math.to_unsigned(registers[reg], 32);
                offset = Utils.Math.to_signed(offset, 16);

                var value = Memory.read(offset + reg, 2);
                write_register(dest, value);

                return { set_PC: false };
            },

            "lb": function (args) {
                var dest = args[0];
                var offset = args[1];
                var reg = args[2];

                reg = Utils.Math.to_unsigned(registers[reg], 32);
                offset = Utils.Math.to_signed(offset, 16);

                var value = Memory.read(offset + reg, 1);
                value = Utils.Math.to_signed(value, 8); // Sign extend
                write_register(dest, value);

                return { set_PC: false };
            },

            "lbu": function (args) {
                var dest = args[0];
                var offset = args[1];
                var reg = args[2];

                reg = Utils.Math.to_unsigned(registers[reg], 32);
                offset = Utils.Math.to_signed(offset, 16);

                var value = Memory.read(offset + reg, 1);
                write_register(dest, value);

                return { set_PC: false };
            },

            "beq": function (args) {
                var reg1 = args[0];
                var reg2 = args[1];
                var imm = args[2];

                var signed_reg1 = Utils.Math.to_signed(registers[reg1], 32);
                var signed_reg2 = Utils.Math.to_signed(registers[reg2], 32);
                var signed_imm = Utils.Math.to_signed(imm, 16);

                if (signed_reg1 === signed_reg2) {
                    return { set_PC: registers["PC"] + 4 + (signed_imm * 4) }
                } else {
                    return { set_PC: false };
                }
            },

            "bne": function (args) {
                var reg1 = args[0];
                var reg2 = args[1];
                var imm = args[2];

                var signed_reg1 = Utils.Math.to_signed(registers[reg1], 32);
                var signed_reg2 = Utils.Math.to_signed(registers[reg2], 32);
                var signed_imm = Utils.Math.to_signed(imm, 16);

                if (signed_reg1 !== signed_reg2) {
                    return { set_PC: registers["PC"] + 4 + (signed_imm * 4) }
                } else {
                    return { set_PC: false };
                }
            },

            "syscall": function (args) {
                var v0 = registers['$2'];

                if (v0 === 1) {
                    // Print int from $a0
                    var int = Utils.Math.to_signed(registers["$4"], 32);
                    output += int.toString();
                }

                if (v0 === 4) {
                    // Print string at address $a0
                    var addr = Utils.Math.to_unsigned(registers["$4"], 32);

                    var tries = 0;
                    while (tries < 1000) {
                        var byte = Memory.read(addr, 1);
                        var char = String.fromCharCode(byte);
                        if (char === "\0") {
                            break;
                        }

                        output += char;

                        addr += 1;
                        tries += 1;
                    }
                }

                if (v0 === 10) {
                    // exit
                    has_exited = true;
                }

                if (v0 === 11) {
                    // Print a character from $a0's low byte
                    var byte = Utils.Math.to_unsigned(registers["$4"], 32) & 0x000000FF;
                    var char = String.fromCharCode(byte);

                    output += char;
                }

                return { set_PC: false };
            }
        }

        // Executes a single instruction
        var run_instruction = function (to_execute) {
            // Update current_inst
            current_inst = to_execute.raw;

            // Make sure the isntruction is recognized
            // (If the parser is working, this should never occur.)
            if (!programs[to_execute.inst]) {
                // FAIL
                throw Utils.get_error(15, [to_execute.raw.text, to_execute.raw.line]);
            }

            // Do the deed!
            return programs[to_execute.inst](to_execute.args);
        };

        // Read/writes to memory
        var Memory = {
            read: function (addr, bytes) {
                // Do we have a memory?
                // (get_mem throws an exception on failure)
                var memory = Memory.get_mem(addr);

                // Are we aligned?
                if (addr % bytes !== 0) {
                    // FAIL
                    throw Utils.get_error(21, [current_inst.line]);
                }

                // Do the deed
                var result = 0;
                for (var i = bytes - 1; i >= 0; i--) {
                    var hex = Utils.Math.to_hex(addr + i);
                    var byte = Utils.get(memory, hex);

                    if (byte === null) {
                        // FAIL
                        throw Utils.get_error(19, [current_inst.line]);
                    }

                    result = (result << 8) | byte;
                }

                // Return the result
                return result;
            },

            write: function (value, addr, bytes) {
                // Do we have a memory?
                // (get_mem throws an exception on failure)
                var memory = Memory.get_mem(addr);

                // Are we aligned?
                if (addr % bytes !== 0) {
                    // FAIL
                    throw Utils.get_error(21, [current_inst.line]);
                }

                // Do the deed
                for (var i = 0; i < bytes; i++) {
                    var to_write = value & 0xff;
                    value = value >>> 8;
                    var hex = Utils.Math.to_hex(addr + i);

                    // Watch for seg fault
                    var byte = Utils.get(memory, hex);
                    if (byte === null) {
                        // FAIL
                        throw Utils.get_error(19, [current_inst.line]);
                    }

                    memory[hex] = to_write;
                }
            },

            // Data, Stack, Overflow, Segfault?
            get_mem: function (addr) {
                // Are we within the data segment?
                // If so, did we seg fault?
                if (addr >= DataParser.base_address && addr <= DataParser.max_address) {
                    var mem = data_segment;
                    var hex = Utils.Math.to_hex(addr);

                    if (Utils.get(mem, hex) === null) {
                        // FAIL
                        throw Utils.get_error(19, [current_inst.line]);
                    }

                    return mem;
                }

                // Are we within the stack segment?
                if (addr >= DataParser.base_stack && addr <= DataParser.max_stack) {
                    return stack;
                }

                // Have we likely stack overflowed?
                if (addr > DataParser.base_stack - 40) {
                    // FAIL
                    throw Utils.get_error(20, [current_inst.line]);
                }

                // If we reach here, we seg faulted. :(
                throw Utils.get_error(19, [current_inst.line]);
            }
        };

        // Runs a single cycle
        var run_cycle = function () {
            if (has_exited) {
                // Only run a cycle if we have not exited.
                return;
            }

            try {
                var PC = registers["PC"];

                // Is the current PC an exit address?
                if (PC === TextParser.base_address - 4 || PC === text.end_addr) {
                    has_exited = true;
                    return;
                }

                // Are we within the cycle limit?
                if (cycles >= cycle_limit) {
                    // FAIL
                    throw Utils.get_error(13, []);
                }

                // Attempt to load the instruction
                var PC_hex = Utils.Math.to_hex(PC);
                var inst = Utils.get(text.segment, PC_hex);
                if (!inst) {
                    // FAIL
                    throw Utils.get_error(14, [PC_hex]);
                }

                // Run the instruction
                var inst_result = run_instruction(inst);

                // Update PC and cycles
                cycles++;

                if (inst_result.set_PC) {
                    registers["PC"] = inst_result.set_PC;
                } else {
                    registers["PC"] = registers["PC"] + 4;
                }
            } catch (e) {
                // Set the error object and note that we exited
                error = e;
                has_exited = true;
            }
        };
        
        // Runs n instructions
        var run_n = function (n) {
            if (n < 1) {
                return;
            }

            for (var i = 0; i < n; i++) {
                run_cycle();

                if (has_exited) {
                    break;
                }
            }

            return get_state();
        };

        // Runs until end or error
        var run_to_end = function () {
            while (!has_exited) {
                run_cycle();
            }

            return get_state();
        };

        // Resets the machine
        var reset = function () {
            // Set all registers to zero
            registers["PC"] = 0;
            registers["HI"] = 0;
            registers["LO"] = 0;
            for (var i = 0; i < 32; i++) {
                registers["$" + i] = 0;
            }

            // Reset the data segment as well
            data_segment = data.segment();

            // Initalize $ra to a special address
            registers["$31"] = TextParser.base_address - 4;

            //  Create a stack segment, point $sp to the top.
            stack = DataParser.create_stack();
            registers["$29"] = DataParser.max_stack;

            // Reset the error
            error = null;

            // Reset the output
            output = "";

            // Reset the current_inst
            current_inst = null;

            // Reset the cycle count
            cycles = 0;

            // Match PC to the main label
            registers["PC"] = text.labels["main"];

            // We have not exited
            has_exited = false;

            return get_state();
        };

        // Returns the current state of the machine (registers, exited, cycle count)
        var get_state = function () {
            // Deep copy registers (helpful?)
            var ret_registers = {};
            ret_registers["PC"] = registers["PC"];
            ret_registers["HI"] = registers["HI"];
            ret_registers["LO"] = registers["LO"];
            for (var i = 0; i < 32; i++) {
                ret_registers["$" + i] = registers["$" + i];
            }

            return {
                registers: ret_registers,
                has_exited: has_exited,
                cycles: cycles,
                data: data_segment,
                stack: stack,
                error: error,
                output: output,
                current_inst: current_inst
            }
        };

        // Run the reset function once to initalize.
        reset();

        // Return out the interface
        return {
            run_n: run_n,
            run_to_end: run_to_end,
            get_state: get_state,
            reset: reset
        };
    };

    // Return out the interface
    return {
        create: create
    };
})();

    return {
        Parser: Parser,
        Runtime: Runtime,
        Utils: Utils
    };
});
