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
    var cycle_limit = 10000000; // Max number of instructions to run

    // RETURNS A NEW INSTANCE OF AN INTERPRETER
    var create = function (data, text) {
        // Counts how many instructions have been executed
        var cycles = 0;

        // Have we exited?
        var has_exited = false;

        // Do we have an error?
        var error = null;

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
                    var imm = args[1];

                    write_register(dest, imm << 16);

                    return { set_PC: false };
                },

                "ori": function (args) {
                    var dest = args[0];
                    var reg = args[1];
                    var imm = args[2];

                    write_register(dest, registers[reg] | imm);

                    return { set_PC: false };
                },

                "addi": function (args) {
                    var dest = args[0];
                    var reg = args[1];
                    var imm = args[2];

                    var signed_reg = Utils.Math.to_signed(registers[reg], 32);
                    var signed_imm = Utils.Math.to_signed(imm, 16);

                    write_register(dest, signed_reg + signed_imm);

                    return { set_PC: false };
                }
            }

            if (!programs[inst.inst]) {
                // FAIL
                throw Utils.get_error(15, [inst.raw.text, inst.raw.line]);
            }

            return programs[inst.inst](inst.args);
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
                if (cycles > cycle_limit) {
                    // FAIL
                    throw Utils.get_error(13, []);
                    return;
                }

                // Attempt to load the instruction
                var PC_hex = Utils.Math.to_hex(PC);
                var inst = text.segment[PC_hex];
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

            //  Create a stack segment, point $sp to its beginning.
            stack = null;
            var stack = DataParser.create_stack();
            registers["$29"] = DataParser.base_stack;

            // Reset the error
            error = null;

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
                error: error
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