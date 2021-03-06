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
        };

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
            unsigned = unsigned ? "u" : "";

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
            unsigned = unsigned ? "u" : "";

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
            final = final || "and";

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
            final = final || "andi";

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
            final = final || "xor";

            // Correct args length?
            if (args.length !== 3) {
                return null;
            }

            // Correct args types?
            // reg, reg, reg
            // reg, reg, imm16
            // reg, reg, imm32
            var reg1 = Utils.Type.reg(args[0]);
            var reg2 = Utils.Type.reg(args[1]);
            var reg3 = Utils.Type.reg(args[2]);
            var imm16 = Utils.Type.imm16u(args[2]);
            var imm32 = Utils.Type.imm32(args[2]);
            var valid = reg1 && reg2 && (reg3 || (imm16 !== null) || (imm32 !== null));

            // Fail if necessary
            if (!valid) {
                return null;
            }

            // Return final instruction(s)
            if (reg3) {
                return [{ inst: final, args: [reg1, reg2, reg3] }];
            }

            if (imm16) {
                return [
                    { inst: "ori", args: ["$1", "$0", imm16] },
                    { inst: final, args: [reg1, reg2, "$1"] }
                ];
            }

            if (imm32) {
                return [
                    { inst: "lui", args: ["$1", Utils.Math.top_16(imm32)] },
                    { inst: "ori", args: ["$1", "$1", Utils.Math.bottom_16(imm32)] },
                    { inst: final, args: [reg1, reg2, "$1"] }
                ];
            }
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
            final = final || "lw";

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
        },

        "bgtz": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Pass on to bgt
            return Insts.bgt([args[0], "0", args[1]]);
        },

        "bltz": function (args) {
            // Correct args length?
            if (args.length !== 2) {
                return null;
            }

            // Pass on to blt
            return Insts.blt([args[0], "0", args[1]]);
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
                label = Utils.Parser.is_label(current[i].args[2]);
                if (!label) {
                    continue;
                }

                // Fail if unmatched label
                val_or_null = Utils.get(data_labels, label);
                if (val_or_null === null) {
                    // FAIL
                    throw Utils.get_error(8, [label, line.line]);
                }

                // Substitute if matched
                current[i].args[2] = Utils.Math.bottom_16(val_or_null);
            }

            if (current[i].inst === "jal" || current[i].inst === "j") {
                // Text label at args[0]?
                label = Utils.Parser.is_label(current[i].args[0]);
                if (!label) {
                    continue;
                }

                // Fail if unmatched label
                val_or_null = Utils.get(text_labels, label);
                if (val_or_null === null) {
                    // FAIL
                    throw Utils.get_error(8, [label, line.line]);
                }

                // Substitute if matched
                current[i].args[0] = (val_or_null & 0xFFFFFFC) >>> 2;
            }

            if (current[i].inst === "bne" || current[i].inst === "beq") {
                // Text label at args[2]?
                label = Utils.Parser.is_label(current[i].args[2]);
                if (!label) {
                    continue;
                }

                // Fail if unmatched label
                val_or_null = Utils.get(text_labels, label);
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