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
            var extracted = Utils.Parser.extract_comment(split[i]);

            // Remove whitespace from the line
            extracted.without = extracted.without.replace(regex_useless, "");
            while (regex_spaces.test(extracted.without)) {
                extracted.without = extracted.without.replace(regex_spaces, " ");
            }
            extracted.without = extracted.without.replace(/(.*)\s+$/im, "$1");

            // Escape strings (for now, we'll unescape later)
            extracted.without = Utils.Parser.escape_strings(extracted.without);

            // Are we blank?
            if (extracted.without === "") {
                continue;
            }        

            result.push({ line: (i + 1), text: extracted.without, comment: extracted.comment });
        }

        // inline labels with the line they are labeling, also remove comments
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
                    throw get_error(0, [input[i].text, input[i].line]);
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