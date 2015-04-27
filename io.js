/*
IO modules are passed into MIPS.runtime as an optional argument.

They must be modules that support three functions:
mem_map(addr): Maps addresses to functions to be called. Returns:
    - If address not found: NULL
    - Otherwise, returns a function that takes (read,mem,val) args. See examples below.
update(): called every time an instruction is executed. IO module can use this to update state.
reset(): Resets the module to its original state.

Addresses for the memory map should be in the 0xFFFF**** range.
*/

var spimbot = (function () {
    var create = function () {
        var position = { x: 150, y: 150 };
        var moving = false;
        var direction = 0; // 0->right, 1->down, 2->left, 3->up
        var tokens = [];

        // Some helper functions
        var to_hex = function (input) {
            return "0x" + input.toString(16).toUpperCase();
        };
        var get = function (table, value) {
            var match = table[value];
            if (typeof match !== "undefined" && table.hasOwnProperty(value)) {
                return match;
            }
            return null;
        };

        // Write the data to memory
        var write_mem = function (memory, value, addr) {
            // Make sure we are aligned
            if (addr % 4 !== 0) {
                return;
            }

            for (var i = 0; i < 4; i++) {
                var to_write = value & 0xff;
                value = value >>> 8;
                var hex = to_hex(addr + i);

                // Make sure the memory exists
                var byte = get(memory, hex);
                if (byte === null) {
                    // FAIL
                    return;
                }

                memory[hex] = to_write;
            }
        };

        // Handlers for various IO addresses.
        var addrs = {
            // Queries or sets the moving status
            "0xFFFF0000": function (read, mem, val) {
                if (read) {
                    // Handle a read to this address
                    return moving ? 1 : 0;
                } else {
                    // Handle a write to this address
                    if (val === 0) {
                        moving = false;
                    } else {
                        moving = true;
                    }
                }
            },

            // Queries or sets the direction
            "0xFFFF0004": function (read, mem, val) {
                if (read) {
                    // Handle a read to this address
                    return direction;
                } else {
                    // Handle a write to this address
                    if (val >= 0 && val <= 3) {
                        direction = val;
                    }
                }
            },

            // Queries the bot x position
            "0xFFFF0008": function (read, mem, val) {
                if (read) {
                    // Handle a read to this address
                    return position.x;
                }
            },

            // Queries the bot y position
            "0xFFFF000C": function (read, mem, val) {
                if (read) {
                    // Handle a read to this address
                    return position.y;
                }
            },

            // Writes token locations to memory
            "0xFFFF00F0": function (read, mem, val) {
                if (read === false) {
                    // Handle a write to this address
                    for (var i = 0; i < tokens.length; i++) {
                        var addrx = (i * 8) + val;
                        var addry = (i * 8) + val + 4;
                        write_mem(mem, tokens[i].x, addrx);
                        write_mem(mem, tokens[i].y, addry);
                        debugger;
                    }
                }
            }
        };

        // Core IO functions
        var mem_map = function (addr) {
            var funct = addrs[addr];
            if (funct) {
                return funct;
            }

            // Address not found
            return null;
        };

        var update = function () {
            if (moving) {
                // Move the bot in the given direction
                var speed = 0.1;
                if (direction == 0) {
                    position.x = position.x + speed;
                }
                if (direction == 2) {
                    position.x = position.x - speed;
                }
                if (direction == 1) {
                    position.y = position.y + speed;
                }
                if (direction == 3) {
                    position.y = position.y - speed;
                }
                if (position.x < 0) {
                    position.x = 0;
                }
                if (position.y < 0) {
                    position.y = 0;
                }
                if (position.x >= 300) {
                    position.x = 299;
                }
                if (position.y >= 300) {
                    position.y = 299;
                }

                // Check to see if any tokens have been collected
                for (var i = 0; i < tokens.length; i++) {
                    var token = tokens[i];
                    if (token.collected === false) {
                        if (Math.abs(position.x - token.x) < 3 && Math.abs(position.y - token.y) < 3) {
                            token.collected = true;
                        }
                    }
                }
            }
        };

        var reset = function () {
            // Reset the state
            position = { x: 150, y: 150 };
            moving = false;
            direction = 0;
            tokens = [];

            // Generate random tokens
            for (var i = 0; i < 10; i++) {
                var x = 5 + Math.floor(Math.random() * 290);
                var y = 5 + Math.floor(Math.random() * 290);
                tokens.push({
                    x: x,
                    y: y,
                    collected: false
                });
            }
        };

        // Create a new canvas element, and renders the bot on it
        var render = function () {
            // Query for the canvas in the DOM
            var canvas = document.querySelector(".spimbot_canvas");

            // If found, get the context
            if (canvas) {
                var context = canvas.getContext("2d");

                // Clear the content
                context.fillStyle = "white";
                context.fillRect(0, 0, 300, 300);

                // Draw the uncollected tokens
                context.fillStyle = "black";
                for (var i = 0; i < tokens.length; i++) {
                    var token = tokens[i];
                    if (token.collected === false) {
                        context.fillRect(token.x - 2, token.y - 2, 4, 4);
                    }
                }

                // Draw the bot
                context.fillStyle = "red";
                context.strokeStyle = "red";
                context.beginPath();
                context.arc(position.x - 3, position.y - 3, 6, 0, 2 * Math.PI);
                context.fill();

                // Draw the bot's nose
                context.moveTo(position.x - 2, position.y - 2);
                if (direction === 0) {
                    context.lineTo(position.x + 8, position.y - 2);
                }
                if (direction === 1) {
                    context.lineTo(position.x - 2, position.y + 8);
                }
                if (direction === 2) {
                    context.lineTo(position.x - 14, position.y - 2);
                }
                if (direction === 3) {
                    context.lineTo(position.x - 2, position.y - 14);
                }
                context.stroke();
            }
        };

        // Return out the interface
        return {
            mem_map: mem_map,
            update: update,
            reset: reset,
            render: render
        }
    };
    
    // Return out the interface
    return {
        create: create
    };
})();

var basic_io = (function () {
    var create = function () {
        var counter = 0;

        var addrs = {
            "0xFFFF0000": function (read, mem, val) {
                if (read) {
                    return counter;
                } else {
                    counter = val;
                }
            }
        };

        var mem_map = function (addr) {
            var funct = addrs[addr];
            if (funct) {
                return funct;
            }

            // Address not found
            return null;
        };

        var update = function () {
            if (counter > 0) {
                counter--;
            }
        };

        var reset = function () {
            counter = 0;
        };

        // return out the interface
        return {
            mem_map: mem_map,
            update: update,
            reset: reset
        }
    };
    
    // Return out the interface
    return {
        create: create
    };
})();
