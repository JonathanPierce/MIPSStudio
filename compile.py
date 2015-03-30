# -*- coding: utf-8 -*-
"""
Created on Mon Mar 30 12:33:45 2015

@author: Jonathan
"""

script = """define(function() {
    %s
    
    %s
    
    %s
    
    %s
    
    %s

    return {
        Parser: Parser,
        Runtime: Runtime,
        Utils: Utils
    };
});
"""

def loadfile(path):
    handle = open(path, "r")
    text = handle.read()
    handle.close()
    return text
    
if __name__ == "__main__":
    Utils = loadfile("utils.js")
    TextParser = loadfile("text.js")
    DataParser = loadfile("data.js")
    Parser = loadfile("parser.js")
    Runtime = loadfile("runtime.js")
    
    # write the JS to disk
    text = script % (Utils, TextParser, DataParser, Parser, Runtime)
    
    handle = open("mips.js", "w")
    handle.write(text)
    handle.close()
    
    print "script written to mips.js"