// Module for parsing a data segment
var DataParser = (function () {
    // Acknowledge load
    console.log('DataParser loaded.');

    // Constants
    var base_address = Utils.const_to_val("0x10000000");
    var max_address = Utils.const_to_val("0x10100000");

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
                throw Utils.get_error(7, [raw[i].line]);
            }
        }

        // Gather all the labels
        for (var i = 0; i < raw.length; i++) {
            var label = raw[i].label;
            if (label) {
                labels[label] = raw[i].base;
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
        // TODO
    };

    var parse = function (raw) {
        var post_validation = verify(raw);
        var post_label = gather_labels(post_validation);

        return post_label.data;
    };

    // Return out the interface
    return {
        parse: parse
    }
})();
