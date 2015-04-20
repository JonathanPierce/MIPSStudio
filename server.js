var http = require('http');
var https = require('https');
var fs = require('fs');
var url = require('url');
var mongodb = require('mongodb').MongoClient; // Installed globally. "npm install -g mongodb"

// Function for logging errors
var error_log = function (err) {
    if (err) {
        console.log("Oops!");
        console.log(err);
    }
};

// Function for reading a file from disk
var get_file = function (path, callback) {
    fs.readFile(__dirname + "/" + path, function (err, data) {
        if (err) {
            error_log(err);
            callback(null);
            return;
        }
        
        // Return the data
        callback(data);
    })
};

// Gets a true MIME for a path
var get_mime = function (path) {
    if (/\.js$/.test(path)) {
        return "text/javascript";
    }
    if (/\.css$/.test(path)) {
        return "text/css";
    }
    if (/\.json$/.test(path)) {
        return "text/json";
    }
    if (/\.pdf$/.test(path)) {
        return "application/pdf";
    }
    if (/\.png$/.test(path)) {
        return "image/png";
    }
    if (/\.jpeg$/.test(path)) {
        return "image/jpeg";
    }
    if (/\.class$/.test(path)) {
        return "application/java-vm";
    }
    return "text/plain";
};

var database = (function () {
    var db, db_projects;

    // Connect to the database upon launch.
    mongodb.connect("mongodb://localhost:27017/studio", function (error, database) {
        if (error) {
            console.log("Remember to start the database!");
            console.log("mongod --dbpath C:\\Users\\Jonathan\\MongoDB");
            throw error;
        }

        // Populate the database object
        db = database;
        db_projects = db.collection("projects");
        console.log("Datebase conenction established successfully.")
    });

    // Insert a new project into the DB
    var insert = function (data, callback) {
        db_projects.insert(data, function (error, result) {
            if (error) {
                callback({ success: false });
            } else {
                callback({ success: true });
            }
        });
    };

    // Remove an existing project from the DB
    var remove = function (id, callback) {
        db_projects.remove({ name: id }, function (error, result) {
            if (error) {
                callback({ success: false });
            } else {
                callback({ success: true });
            }
        });
    };

    // Update an existing project in the DB
    var update = function (id, newtext, callback) {
        db_projects.update({ name: id }, { $set: { text: newtext } }, function (error, result) {
            if (error) {
                callback({ success: false });
            } else {
                callback({ success: true });
            }
        });
    };

    // Returns a specific matching project from the DB.
    var query = function (id, callback) {
        db_projects.findOne({ name: id }, function (error, result) {
            if (error) {
                callback("ERROR LOADING DATA");
            } else {
                callback(result.text);
            }
        });
    };

    // Returns the name of every project in the DB.
    var query_all = function (callback) {
        db_projects.find({}).toArray(function (error, projects) {
            var results = [];

            if (error) {
                return callback(results);
            }

            for (var i = 0; i < projects.length; i++) {
                results.push(projects[i].name);
            }

            callback(results);
        });
    };

    // Return out the interface
    return {
        insert: insert,
        remove: remove,
        update: update,
        query: query,
        query_all: query_all
    }
})();

// Responders for requests at a given path.
var responders = {
    // Returns the file at ?path=path/to/file.ext
    "/file": function (req, res) {
        var parsed_url = url.parse(req.url, true);
        var file_path = parsed_url.query.path;
        
        if (file_path) {
            // Set the correct file type
            var file_type = get_mime(file_path);
            
            // Grab the file and return it
            get_file(file_path, function (data) {
                if (data) {
                    res.writeHead(200, { 'Content-Type': file_type });
                    res.end(data);
                } else {
                    // 404
                    responders["404"](req, res);
                }
                
            });
        } else {
            // 404
            responders["404"](req, res);
        }
    },

    // Returns the mips.js file for require.js to use
    "/mips.js": function(req, res) {
        get_file("mips.js", function (data) {
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            res.end(data);
        });
    },

    // Returns the tests.js file for require.js to use
    "/tests.js": function(req, res) {
        get_file("tests.js", function (data) {
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            res.end(data);
        });
    },
    
    // Return the home page HTML
    "/": function (req, res) {
        get_file("testbed.html", function (data) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    },

    // Create a new project
    "/create": function(req,res) {
        var parsed_url = url.parse(req.url, true);
        var name = parsed_url.query.name;
        var text = parsed_url.query.text;
        var data = {
            name: name,
            text: text
        };

        database.insert(data, function (result) {
            res.writeHead(200, { "Content-Type": "text/json" });
            res.end(JSON.stringify(result));
        });
    },

    // Deletes an existing project
    "/delete": function (req, res) {
        var parsed_url = url.parse(req.url, true);
        var name = parsed_url.query.name;

        database.remove(name, function (result) {
            res.writeHead(200, { "Content-Type": "text/json" });
            res.end(JSON.stringify(result));
        });
    },

    // Updates an existing project
    "/save": function (req, res) {
        var parsed_url = url.parse(req.url, true);
        var name = parsed_url.query.name;
        var text = parsed_url.query.text;

        database.update(name, text, function (result) {
            res.writeHead(200, { "Content-Type": "text/json" });
            res.end(JSON.stringify(result));
        });
    },

    // Returns a list of all projects
    "/list": function (req, res) {
        database.query_all(function (result) {
            res.writeHead(200, { "Content-Type": "text/json" });
            res.end(JSON.stringify({projects: result}));
        });
    },

    // Returns the full content of a specific project
    "/open": function (req, res) {
        var parsed_url = url.parse(req.url, true);
        var name = parsed_url.query.name;

        database.query(name, function (result) {
            res.writeHead(200, { "Content-Type": "text/json" });
            res.end(JSON.stringify({text: result }));
        });
    },

    // Return a 404 page
    "404": function (req, res) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Hmm... it seems that we are unable to handle that request.\n');
    }
};

// The main server listener
http.createServer(function (req, res) {
    var parsed_url = url.parse(req.url);
    
    var responder = responders[parsed_url.pathname];
    if (responder) {
        // Respond appropriately
        responder(req, res);
        return;
    }

    // Return a 404 if no responder was found
    responders["404"](req, res);
}).listen(1337);