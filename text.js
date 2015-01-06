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
                return [{ inst: "add", args: [reg1, reg2, reg3] }];
            }

            if(imm16 !== null) {
                return [{inst: "addi", args: [reg1, reg2, imm16] }];
            }

            if(imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32) ] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32) ] },
                    { inst: "add", args: [reg1, reg2, "$1"] }
                ];
            }
        },

        "addu": function (args) {
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
                return [{ inst: "addu", args: [reg1, reg2, reg3] }];
            }

            if (imm16 !== null) {
                return [{ inst: "addiu", args: [reg1, reg2, imm16] }];
            }

            if (imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: "addu", args: [reg1, reg2, "$1"] }
                ];
            }
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

        "sub": function (args) {
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
                return [{ inst: "sub", args: [reg1, reg2, reg3] }];
            }

            if (imm16 !== null) {
                return [{ inst: "subi", args: [reg1, reg2, imm16] }];
            }

            if (imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: "sub", args: [reg1, reg2, "$1"] }
                ];
            }
        },

        "subu": function (args) {
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
                return [{ inst: "subu", args: [reg1, reg2, reg3] }];
            }

            if (imm16 !== null) {
                return [{ inst: "subiu", args: [reg1, reg2, imm16] }];
            }

            if (imm32 !== null) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: "subu", args: [reg1, reg2, "$1"] }
                ];
            }
        },

        "subi": function (args) {
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
            return [{ inst: "subi", args: [reg1, reg2, imm16] }];
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
            return [{ inst: "subiu", args: [reg1, reg2, imm16] }];
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
            return [{ inst: "multu", args: [reg1, reg2] }];
        },

        "divu": function (args) {
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
            return [{ inst: "divu", args: [reg1, reg2] }];
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
            var imm16 = Utils.Type.imm16(args[1]);
            var valid = reg1 && (imm16 !== null);

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            return [ { inst: "lui", args: [reg1, imm16] } ];
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