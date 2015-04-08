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