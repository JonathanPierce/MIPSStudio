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