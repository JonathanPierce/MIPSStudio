var TextParser = (function () {
    /*

    - Verify instrucition validity
    -- Valid instruction type
    -- Correct number of args for instruction
    -- Correct types of args for instruction (regisiters in range, immediates in range...)
    -- Identify pseudoinstructions
    - Perform pseudoinstruction conversions
    -- Add insts field to raw object (for all instructions)
    -- Split pseudos into one or more true instructions
    -- Assign a base PC address to each raw object
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

    // Return out the interface
    return {
        parser: null,
        base_address: base_address,
        max_address: max_address
    };
})();