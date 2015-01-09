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
        
        // Runs n instructions
        var run_n = function () {

        };

        // Runs until end or error
        var run_to_end = function () {

        };

        // Resets the machine
        var reset = function () {

        };

        // Run the reset function once to initalize.
        reset();

        // Returns the current state of the machine
        var get_state = function () {

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