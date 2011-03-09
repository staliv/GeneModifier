#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("./FileLineReader");
var exec = require("child_process").exec;
var cores = require("os").cpus().length;
var Worker = require("../node_modules/worker").Worker;
var settings = require("../settings").settings;


//Accepts a merged .sam file sorted on the read ID and keeps only the best match based on YM:i
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 25, process.argv[1].length) == "/KeepBestMatchParallel.js") {
	if (process.argv.length <= 2) {
		sys.puts("Accepts a merged .sam file sorted on the read ID and keeps only the best match based on YM:i.\nExample usage: 'node KeepBestMatchParallel.js samFilePath'");
	}
	else {
		keepBestMatch(process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				sys.error(error.message);
//				return;
			}
			//sys.puts(message);
		});
	}
}

exports.keepBestMatch = keepBestMatch;

var parseCount = 0;
var filesToParse = [];
var pileFiles = null;
//Returns callback(error, message)
function keepBestMatch(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};


	path.exists(samFilePath, function(exists) {
		if (!exists) {
			return callback(new Error("The file " + samFilePath + " does not exist."));
		} else {
			exec("wc -l " + samFilePath, function(error, stdout, stderr) {
				if (error) {return callback(error); }

				nrOfLines = parseFloat(trim(stdout).split(" ")[0]);

				splitToFiles(samFilePath, function(error, files) {
					if (error) { return callback(error); }
					filesToParse = files;
					pileFiles = new Pile();
					sys.error("Received " + filesToParse.length + " files");
					filesToParse.forEach(function(element, i) {
						pileFiles.add(function parseFile(next) {
							sys.error("Parsing " + filesToParse[i][0] + "...");
							lineReader = null;
							lineReader = fileLineReader.FileLineReader(filesToParse[i][0], 1024 * 128);
							parseCount++;
							commenceIteration(1, filesToParse[i][1], function(error, message) {
								--parseCount;
								sys.error("Finished parsing " + filesToParse[i][0]);
								if (settings.removeIntermediateFiles) {
									sys.error("Removing " + filesToParse[i][0]);
									fs.unlinkSync(filesToParse[i][0]);
								}
								next();
							});
						});
					});
					pileFiles.run(function() {}, 1);
				});
				
			});
		}
	});
}

function splitToFiles(samFile, callback) {
	
	var maxNumberOfLines = Math.round((nrOfLines / 10));
	var files = [];
	if (nrOfLines > maxNumberOfLines) {

		var nrOfWholeSplits = Math.floor(nrOfLines / maxNumberOfLines);
		var lastSplit = nrOfLines - (nrOfWholeSplits * maxNumberOfLines);
		var splits = [];
		for (var i=0; i < nrOfWholeSplits; i++) {
			splits.push(maxNumberOfLines);
		}
		if (lastSplit > 0) {
			splits.push(lastSplit);
		}
		
		//Split file to a maximum number of lines
		var alreadySplitted = 0;
		var splitCounter = 0;
		var splitFiles = [];
//		for (var i=0; i < splits.length; i++) {
		splits.forEach(function(element, i) {
			splitCounter++;
			splitFiles[i] = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".split" + i + ".sam";
			alreadySplitted += splits[i];
			exec("head -n " + (alreadySplitted + splits[i]) + " " + samFile + " | tail -n " + splits[i] + " > " + splitFiles[i], function(error, stdout, stderr) {
				if (error) {return callback(error); }
				if (stderr) {sys.error(stderr); }
				files[i] = [splitFiles[i], splits[i]];
//				sys.error(i + " : " + splits.length);
				--splitCounter;
				if (splitCounter === 0) {
					sys.error("Splitted to " + files.length + " files.");
					callback(null, files);
				}
			});
		});
		
	} else {
		files.push([samFile, nrOfLines]);
		callback(null, files);
	}
}

function trim(string) {
    return string.replace(/^\s*|\s*$/, '');
}

var allLines = [];
var lineCounter = 0;
var nrOfLines = null;
var lineReader = null;
var linesPerParser = 20000;
var linesPerIteration = linesPerParser * cores * 2;
var totalCounter = 0;
var iterationStartTime = null;
var lines = [];
var remainingLines = [];

function commenceIteration(iteration, nrOfLines, callback) {

	var nrOfIterations = Math.ceil(nrOfLines / linesPerIteration);
	if (iteration > 1) {
		var meanIterationTime = Math.round((new Date().getTime() - iterationStartTime) / 1000 / iteration);
		sys.error("Mean iteration time: " + meanIterationTime + " seconds.");
		sys.error("Time remaining: " + ((meanIterationTime * nrOfIterations) - ((iteration -1) * meanIterationTime)) + " seconds.");
	} else {
		iterationStartTime = new Date().getTime();
	}

	sys.error("Iteration " + (iteration) + " of " + nrOfIterations);
	
	var pilex = new Pile();
	var linesToIterate = linesPerIteration;
	var line = null;
	allLines = [];
	lineCounter = 0;
	
	if (nrOfLines < (linesPerIteration * (iteration))) {
		linesToIterate = nrOfLines - (linesPerIteration * iteration);
		if (linesToIterate < 0) {
			linesToIterate = nrOfLines - linesPerIteration * (iteration - 1);
		}
	}

	for (var i = 0; i < linesToIterate; i++){

		line = lineReader.nextLine();
		lineReader.hasNextLine();
		totalCounter++;

		if (line.substr(0, 3) === "@SQ" || line.substr(0,3) === "@PG" || line.substr(0,3) === "@RG" || line.substr(0,3) === "@HD") {
			sys.error("Found header on line: " + totalCounter + " :: " + line);
			sys.puts(line);
		} else {

			//Check last line has same id as previous line, if so then it is safe to add 
			if (i % linesPerParser === linesPerParser - 1 && lines.length > 0) {
				if (line.split("\t")[0] === lines[lines.length - 1].split("\t")[0]) {
					lines.push(line);
				} else {
					remainingLines.push(line);
				}
			}else {
				lines.push(line);
			}
			if (lines.length === linesPerParser) {
				allLines.push(lines);

				pilex.add(function createParser(next) {

					var lineParser = new Worker("./utils/workers/KeepBestMatchParser.js");
					sys.error("\tSending\t" + allLines[lineCounter].length + " lines...");
					lineParser.postMessage({"lines": allLines[lineCounter]});
					lineCounter++;
					lineParser.addListener("message", function (msg) {
						sys.puts(msg.out.join("\n"));
						sys.error("\tReceived\t" + msg.out.length + " lines");
						lineParser.terminate();
						lineParser.kill();
						next();
					});
				});

				sys.error("\tPile is of length: " + pilex.pile.length + "\tallLines.length = " + allLines.length + "\tallLines.last.length = " + allLines[allLines.length - 1].length);

				lines = remainingLines;
				remainingLines = [];
			}

		}
	}
	if (lines.length > 1 || (lines.length > 0 && iteration === nrOfIterations)) {
		allLines.push(lines);

		pilex.add(function createParser(next) {

			var lineParser = new Worker("./utils/workers/KeepBestMatchParser.js");

			sys.error("\tSending\t" + allLines[lineCounter].length + " lines...");
			lineParser.postMessage({"lines": allLines[lineCounter]});
			lineCounter++;

			lineParser.addListener("message", function (msg) {
				sys.puts(msg.out.join("\n"));
				sys.error("\tReceived\t" + msg.out.length + " lines");
				lineParser.terminate();
				lineParser.kill();
				next();
			});
		});

		sys.error("\tPile is of length: " + pilex.pile.length + "\tallLines.length = " + allLines.length + "\tallLines.last.length = " + allLines[allLines.length - 1].length);

		lines = [];
	}

	pilex.run(function() {
		sys.error("Iteration " + (iteration) + " is complete.");
		if (((iteration) * linesPerIteration) < nrOfLines) {
			commenceIteration(iteration + 1, nrOfLines, callback);
		} else {
			sys.error("Parsed " + totalCounter + " lines.");
			callback(null, "");
		}
	}, cores);
}

var Pile = function() {
   this.pile = [];
   this.concurrency = 0;
   this.done = null;
   this.max_concurrency = 10;
};

Pile.prototype = {
	add: function(callback) {
		this.pile.push(callback);
	},
	run: function(done, max_concurrency) {
		this.done = done || this.done;
		this.max_concurrency = max_concurrency || this.max_concurrency;
		var target = this.pile.length;
		var self = this;
		var next = function() {
			self.concurrency--;
			(--target === 0) ? self.done() : self.run();
		};
		while(this.concurrency < this.max_concurrency && this.pile.length > 0) {
			this.concurrency++;
			var callback = this.pile.shift();
			callback(next);
		}
	}
};
