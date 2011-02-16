#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("./FileLineReader");

//Accepts a merged .sam file sorted on the read ID and keeps only the best match based on YM:i
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 17, process.argv[1].length) == "/KeepBestMatch.js") {
	if (process.argv.length <= 2) {
		sys.puts("Accepts a merged .sam file sorted on the read ID and keeps only the best match based on YM:i.\nExample usage: 'node KeepBestMatch.js samFilePath'");
	}
	else {
		keepBestMatch(process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			//sys.puts(message);
		});
	}
}

exports.keepBestMatch = keepBestMatch;

//Returns callback(error, message)
function keepBestMatch(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	path.exists(samFilePath, function(exists) {
		if (!exists) {
			return callback(new Error("The file " + samFilePath + " does not exist."));
		} else {
			var lineReader = fileLineReader.FileLineReader(samFilePath);
			var line = null;
			var previousLines = [];
			
			while (true) {
				line = lineReader.nextLine();
				if (line.substr(0,3) === "@SQ") {
					sys.puts(line);
				} else {
					var readId = line.substr(0, line.indexOf("\t"));
					var score = parseFloat(line.substr(line.indexOf("YM:i:") + 5, 2));
					if (previousLines.length === 0) {
						//Push a new compare object
						previousLines.push({"id": readId, "score": score, "line": line});
					} else if (previousLines[0].id === readId) {
						//Add one more compare object
						previousLines.push({"id": readId, "score": score, "line": line});
					} else if (previousLines[0].id !== readId) {
						//Compare previous objects
						compareAndOutput(previousLines);
						//Empty the array
						previousLines = [];
    					//Push current line as new compare object
	                    previousLines.push({"id": readId, "score": score, "line": line});
					}
				}
				if (!lineReader.hasNextLine()) {
					//Last line should be compared
					compareAndOutput(previousLines);
					break;
				}
			}
			callback(null, "Done");
		}
	});
}

function compareAndOutput(previousLines) {
	if (previousLines.length >= 2) {
		//Sort based on score
		previousLines.sort(sortLines);
		//Keep the best one, i.e. the first one
		var keep = previousLines[0];
		
		//Check for alternative hits in the other matches with same score
		for (var x = 1; x < previousLines.length; x++) {
			if (previousLines[x].score === keep.score && previousLines[x].line.indexOf("XA:Z:") > -1) {
				keep = addAltHits(keep, previousLines[x]);
			}
		}
		//Output best match
		sys.puts(keep.line);
	} else {
		//Only one match
		sys.puts(previousLines[0].line);
	}
}

function addAltHits(keep, other) {

	//Extract alternative hits
	var altPosition = other.line.indexOf("XA:Z:");
	var altHits = other.line.substr(altPosition + 5).split("\t")[0];
	
	var keepLine = keep.line.split("\t");
	
	if (keep.line.indexOf("XA:Z:")) {
		for (var i = 11; i < keepLine.length; i++) {
			if (keepLine[i].length >= 5 && keepLine[i].substr(0, 5) === "XA:Z:") {
				keepLine[i] += altHits;
				break;
			}
		}
	} else {
		keepLine.push("XA:Z:" + altHits);
	}
	keep.line = keepLine.join("\t");
	return keep;
}

var sortLines = function(a, b) {
	var lineAScore = a.score, lineBScore = b.score;
	
	if (lineAScore > lineBScore) {
		return -1;
	}
	if (lineAScore < lineBScore) {
		return 1;
	}
	return 0;
}
