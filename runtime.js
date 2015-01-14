// Returns an interpreter instance
var MIPSRuntime = (function () {
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

    // Acknowledge load
    console.log('MIPSRuntime loaded.');

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

        // The stack. Will be created by init.
        var stack = null;

        // Executes a single instruction
        var run_instruction = function (inst) {
            var write_register = function (reg, value) {
                // Make sure we aren't $0.
                if (reg === "$0") {
                    // FAIL
                    throw Utils.get_error(16, [inst.raw.text, inst.raw.line]);
                }

                // Convert to unsigned, write the registers
                registers[reg] = Utils.Math.to_unsigned(value, 32);
            };

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
                        throw Utils.get_error(18, [inst.raw.line]);
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

                    Memory.write(src, offset + reg, bits, inst.raw);

                    return { set_PC: false };
                },

                "sh": function(args) {
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

                    var value = Memory.read(offset + reg, 4, inst.raw);
                    write_register(dest, value);

                    return { set_PC: false };
                },

                "lh": function (args) {
                    var dest = args[0];
                    var offset = args[1];
                    var reg = args[2];

                    reg = Utils.Math.to_unsigned(registers[reg], 32);
                    offset = Utils.Math.to_signed(offset, 16);

                    var value = Memory.read(offset + reg, 2, inst.raw);
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

                    var value = Memory.read(offset + reg, 2, inst.raw);
                    write_register(dest, value);

                    return { set_PC: false };
                },

                "lb": function (args) {
                    var dest = args[0];
                    var offset = args[1];
                    var reg = args[2];

                    reg = Utils.Math.to_unsigned(registers[reg], 32);
                    offset = Utils.Math.to_signed(offset, 16);

                    var value = Memory.read(offset + reg, 1, inst.raw);
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

                    var value = Memory.read(offset + reg, 1, inst.raw);
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
                            var byte = Memory.read(addr, 1, inst.raw);
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

            if (!programs[inst.inst]) {
                // FAIL
                throw Utils.get_error(15, [inst.raw.text, inst.raw.line]);
            }

            // Do the deed!
            return programs[inst.inst](inst.args);
        };

        // Read/writes to memory
        var Memory = {
            read: function (addr, bytes, raw) {
                // Do we have a memory?
                // (get_mem throws an exception on failure)
                var memory = Memory.get_mem(addr, raw);

                // Are we aligned?
                if (addr % bytes !== 0) {
                    // FAIL
                    throw Utils.get_error(21, [raw.line]);
                }

                // Do the deed
                var result = 0;
                for (var i = bytes - 1; i >= 0; i--) {
                    var hex = Utils.Math.to_hex(addr + i);
                    var byte = Utils.get(memory, hex);

                    if (byte === null) {
                        // FAIL
                        throw Utils.get_error(19, [raw.line]);
                    }

                    result = (result << 8) | byte;
                }

                // Return the result
                return result;
            },

            write: function (value, addr, bytes, raw) {
                // Do we have a memory?
                // (get_mem throws an exception on failure)
                var memory = Memory.get_mem(addr, raw);

                // Are we aligned?
                if (addr % bytes !== 0) {
                    // FAIL
                    throw Utils.get_error(21, [raw.line]);
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
                        throw Utils.get_error(19, [raw.line]);
                    }

                    memory[hex] = to_write;
                }
            },

            // Data, Stack, Overflow, Segfault?
            get_mem: function (addr, raw) {
                // Are we within the data segment?
                // If so, did we seg fault?
                if (addr >= DataParser.base_address && addr <= DataParser.max_address) {
                    var mem = data.segment;
                    var hex = Utils.Math.to_hex(addr);

                    if (Utils.get(mem, hex) === null) {
                        // FAIL
                        throw Utils.get_error(19, [raw.line]);
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
                    throw Utils.get_error(20, [raw.line]);
                }

                // If we reach here, we seg faulted. :(
                throw Utils.get_error(19, [raw.line]);
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
                    return;
                }

                // Attempt to load the instruction
                var PC_hex = Utils.Math.to_hex(PC);
                var inst = Utils.get(text.segment, PC_hex);
                if (!inst) {
                    // FAIL
                    throw Utils.get_error(14, [PC_hex]);
                    return;
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

            // Initalize $ra to a special address
            registers["$31"] = TextParser.base_address - 4;

            //  Create a stack segment, point $sp to the top.
            stack = null;
            stack = DataParser.create_stack();
            registers["$29"] = DataParser.max_stack;

            // Reset the error
            error = null;

            // Reset the output
            output = "";

            // Match PC to the main label
            registers["PC"] = text.labels["main"];

            // We have not exited
            has_exited = false;
        };

        // Run the reset function once to initalize.
        reset();

        // Returns the current state of the machine (registers, exited, cycle count)
        var get_state = function () {
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
                data: data,
                text: text,
                stack: stack,
                error: error,
                output: output
            }
        };

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