var Utils = (function () {
    // Acknowledge load
    console.log('Utils loaded.');

    // Constants
    var regex_hex = /^0x[0-9a-fA-F]{1,8}$/mi;
    var regex_integer = /^-?[0-9]+$/mi;
    var regex_binary = /^0(b|B)([01]{1,32}$)/mi;
    var regex_char = /^'.'$/mi;
    var regex_comment = /(#|\/\/)(.*)/im;
    var regex_offset = /^([0-9A-Za-z_]+)\((\$.{1,4})\)$/im;

    // get_error: Return a proper error to throw
    var get_error = function (index, args) {
        var error_codes = [
        "Could not parse constant ($1) on line $2.",
        "More than one data segment detected. Your code should only have one '.data' directive.",
        "Your code needs exactly one .text directive.",
        "The data segment was not found before the text segment, or there was ancillary text above the text segment."
        ];

        var current = error_codes[index];

        args = args || [];
        for (var i = 0; i < args.length; i++) {
            var to_replace = "$" + (i + 1);

            current = current.replace(to_replace, args[i]);
        }

        return { code: index, message: current };
    };

    // Wrapper for String.match that handles the case of no matches with an empty array instead of null
    var apply_regex = function (regex, input) {
        var result = input.match(regex);

        return result ? result : [];
    };

    // const_to_val: Converts a string to an integer value
    // NOTE: Does not check bounds or enforce signed/unsigned.
    // NOTE: This function is designed for assembly constants ('speed = 10')
    var const_to_val = function (input, line) {
        // Is this hex or a plain integer?
        if (regex_hex.test(input) || regex_integer.test(input)) {
            return Number(input);
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
        if (regex_char.test(input)) {
            return input.charCodeAt(1);
        }

        // If we made it here, throw an error
        throw get_error(0, [input, line]);
    };

    // PARSER: Various parser hlper functions
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

        // Returns a pair of offset, register, and the rest (if found) or null
        parse_offset: function (input) {
            if (regex_offset.test(input)) {
                var offset = input.replace(regex_offset, "$1");
                var reg = input.replace(regex_offset, "$2");
                return { offset: offset, reg: reg};
            } else {
                return null;
            }
        }
    };

    // Joins an array by the propery of one of its objects
    var join_by_prop = function (arr, prop, split) {
        var result = "";

        for (var i = 0; i < arr.length; i++) {
            result += arr[i][prop];

            if (i < arr.length - 1) {
                result += split;
            }
        }

        return result;
    };

    // Return out the interface
    return {
        const_to_val: const_to_val,
        join_by_prop: join_by_prop,
        get_error: get_error,
        apply_regex: apply_regex,
        Parser: Parser
    };
})();