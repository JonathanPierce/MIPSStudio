var TextParser = (function () {
    /*

    - Verify instrucition validity
    -- Valid instruction type
    -- Correct number of args for instruction
    -- Correct types of args for instruction (regisiters in range, immediates in range...)
    -- Perform pseudoinstruction conversions
    --- Split pseudos into one or more true instructions
    --- Assign a base PC address to each raw object
    - Gather labels
    -- Make sure labels only declared once, don't conflict with data labels
    -- Match each text label with a PC address
    -- Replace all instances of the label in load/store instructions (error if label has no match)
    - Create PC map
    -- Links each PC address to a raw object
    -- All done!

    */

    // Acknowledge load
    console.log('TextParser loaded.');

    // Constants
    var base_address = Utils.const_to_val("0x00400000");
    var max_address = Utils.const_to_val("0x00500000");

    // Validate all instructions
    var validate = function (raw) {
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

                // TODO: raw[i].instructions = ... / error handling
                if(insts_or_null) {
                    raw[i].instructions = insts_or_null;
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
        "add": function(args) {
            // Correct args length?
            if(args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            // reg, reg, imm16/s
            // reg, reg, imm32/s
            var valid = false;
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            if(reg1 && reg2 && reg3) {
                valid = true; // reg reg reg
            } else {
                var imm16s = Utils.Type.imm16s(args[2]);
                var imm32s = Utils.Type.imm32s(args[2]);
                if(reg1 && reg2 && (imm16s || imm32s)) {
                    valid = true;
                }
            }

            // Fail if necessary
            if(!valid) {
                return null;
            }

            // Return final instruction(s)
            if(reg3) {
                return [{ inst: "add", args: [reg1, reg2, imm16s] }];
            }

            if(imm16s) {
                return [{inst: "addi", args: [reg1, reg2, imm32s] }];
            }

            if(imm32s) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32s) ] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32s) ] },
                    { inst: "add", args: [reg1, reg2, "$1"] }
                ];
            }
        }
    };

    // Gather labels
    var gather_labels = function () {
        // TODO
    };

    // Create the final PC map
    var finalize = function () {
        // TODO
    };

    var parse = function (raw_insts, labels) {
        // TEMP
        return validate(raw_insts);
    };

    // Return out the interface
    return {
        parse: parse,
        base_address: base_address,
        max_address: max_address
    };
})();