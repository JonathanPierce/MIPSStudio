// Module for parsing a data segment
var DataParser = (function () {
    // Acknowledge load
    console.log('DataParser loaded.');

    // Constants
    var regex_label_dec = /^[a-zA-Z_][a-zA-Z0-9_]*:$/im;
    var regex_type = /\.(word|half|byte|ascii|asciiz|float|double|space|align)/i;
    var base_address = Utils.const_to_val("0x10000000");
    var max_address = Utils.const_to_val("0x20000000");

    // Each line must have a label (optional), type, and 1 or more arguments of that type/labels
    var verify = function (raw) {
        // TODO
    };

    // Convert each line into the preliminary data segment object
    var convert = function (raw) {
        // TODO
    };

    // Find label declarations and replace appropriately
    var gather_labels = function (raw) {
        // TODO
    };

    // Convert preliminary data to the final data
    var to_final = function (raw) {
        // TODO
    };

    var parse = function (raw) {
        // TODO
    };

    // Return out the interface
    return {
        parse: parse
    }
})();
