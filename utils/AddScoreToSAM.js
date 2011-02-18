#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var scoreCalculator = require("./CalculateAlignmentScore");
var fileLineReader = require("./FileLineReader");

var log4js = require("../node_modules/log4js")();
log4js.configure("logs/config.json");

//Accepts the sam path from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 17, process.argv[1].length) == "/AddScoreToSAM.js") {
	if (process.argv.length <= 2) {
		sys.puts("Example usage: 'node AddScoreToSAM.js pathToSAMFile'");
	}
	else {
		addScoreToSAM(process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			//sys.puts(message);
		});
	}
}

exports.addScoreToSAM = addScoreToSAM;

//Returns callback(error, newSAMFilePath)
function addScoreToSAM(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	path.exists(samFilePath, function(exists) {
		if (exists) {
			var lineReader = fileLineReader.FileLineReader(samFilePath);
			var line = null,
				splitLine = [];

				
			while (true) {
				line = lineReader.nextLine();
				splitLine = line.split("\t");
				
				var cigar = "",
					mismatches = null;

				if (line.substr(0, 3) === "@SQ" || line.substr(0,3) === "@PG" || line.substr(0,3) === "@RG" || line.substr(0,3) === "@HD") {
					sys.puts(line);
				} else {
					cigar = splitLine[5];

					//Find MD:Z (mismatches)
					for (var i = 11; i < splitLine.length; i++) {
						if (splitLine[i].split(":")[0] === "MD") {
							mismatches = splitLine[i].split(":");
							mismatches = mismatches[mismatches.length - 1];
							i = splitLine.length;
						}
					}
					sys.puts(line + "\tYM:i:" + scoreCalculator.getAlignmentScore(cigar, mismatches));
				}

				if (!lineReader.hasNextLine()) {
					break;
				}
			}
			
			callback(null, "");
			
		} else {
			return callback(new Error("The path to SAM file '" + pathToSAM + "' does not exist."));		
		}
	
	});

}