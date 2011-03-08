#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var scoreCalculator = require("./CalculateAlignmentScore");
var fileLineReader = require("./FileLineReader");
var cores = require("os").cpus().length * 2;
var Worker = require("../node_modules/worker").Worker;
var exec = require("child_process").exec;

//var log4js = require("../node_modules/log4js")();
//log4js.configure("logs/config.json");

//Accepts the sam path from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 25, process.argv[1].length) == "/AddScoreToSAMParallel.js") {
	if (process.argv.length <= 2) {
		sys.puts("Example usage: 'node AddScoreToSAMParallel.js pathToSAMFile'");
	}
	else {
		addScoreToSAM(process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				console.dir(error);
				return;
			}
			//sys.puts(message);
		});
	}
}

exports.addScoreToSAM = addScoreToSAM;


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
//			console.log("conc = " + this.concurrency + " < max = " + this.max_concurrency);
			this.concurrency++;
			var callback = this.pile.shift();
			callback(next);
		}
	}
};

var allLines = [];
var lineCounter = 0;
var nrOfLines = null;
var lineReader = null;
var linesPerParser = 10000;
var linesPerIteration = linesPerParser * cores * 4;
var totalCounter = 0;
var iterationStartTime = null;
function commenceIteration(iteration, next) {

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
	var lines = [];
	var linesToIterate = linesPerIteration;
	var line = null;
	
	if (nrOfLines < (linesPerIteration * (iteration))) {
		linesToIterate = nrOfLines - (linesPerIteration * iteration);
		if (linesToIterate < 0) {
			linesToIterate = nrOfLines - linesPerIteration * (iteration - 1);
		}
	}

//	sys.error("Lines = " + linesToIterate);

	for (var i = linesToIterate - 1; i >= 0; i--){

//	for (var i = 0; i < linesToIterate; i++) {
		line = lineReader.nextLine();
		lineReader.hasNextLine();

		if (line.substr(0, 3) === "@SQ" || line.substr(0,3) === "@PG" || line.substr(0,3) === "@RG" || line.substr(0,3) === "@HD") {
			sys.puts(line);
		} else {
			totalCounter++;
//			console.log(line);
			lines.push(line);
			if (lines.length === linesPerParser) {
				allLines.push(lines);

				pilex.add(function createParser(next) {

					var lineParser = new Worker("./utils/workers/AddScoreParser.js");

					lineParser.postMessage({"lines": allLines[lineCounter]});
					lineCounter++;
					lineParser.addListener("message", function (msg) {
						sys.puts(msg.out.join("\n"));
//						sys.error("Received " + msg.out.length + " lines");
						lineParser.terminate();
//						lineParser.kill();
						next();
					});
				});

//				sys.error(pilex.pile.length);
//				sys.error(allLines[allLines.length - 1].length);

				lines = [];
			}

		}
	}
	if (lines.length > 0) {
		allLines.push(lines);

		pilex.add(function createParser(next) {

			var lineParser = new Worker("./utils/workers/AddScoreParser.js");

			lineParser.postMessage({"lines": allLines[lineCounter]});
			lineCounter++;

			lineParser.addListener("message", function (msg) {
				sys.puts(msg.out.join("\n"));
//				sys.error("Received " + msg.out.length + " lines");
				lineParser.terminate();
//				lineParser.kill();
				next();
			});
		});

//		sys.error(pilex.pile.length);
//		sys.error(allLines[allLines.length - 1].length);

		lines = [];
	}

	pilex.run(function() {
		sys.error("Iteration " + (iteration) + " is completed.");
		if (((iteration) * linesPerIteration) < nrOfLines) {
			commenceIteration(iteration + 1);
		} else {
			sys.error("Parsed " + totalCounter + " lines.");
		}
	}, cores);
}

//Returns callback(error, newSAMFilePath)
function addScoreToSAM(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	path.exists(samFilePath, function(exists) {
		if (exists) {
//			console.log(samFilePath.replace(/ /g, "\\ "));
			exec("wc -l " + samFilePath, function(error, stdout, stderr) {
				if (error) { return callback(error); }
				nrOfLines = parseFloat(trim(stdout).split(" ")[0]);
				lineReader = fileLineReader.FileLineReader(samFilePath, 1024 * 128);

				commenceIteration(1);
/*				
				pilex.add(function createParser(next) {

					var lineParser = new Worker("./utils/workers/AddScoreParser.js");

					lineParser.postMessage({"lines": allLines[lineCounter]});
					lineCounter++;

					lineParser.addListener("message", function (msg) {
						sys.puts(msg.out.join("\n"));
						lineParser.terminate();
						lineParser.kill();
						next();
					});
				});
*/

/*
				for (var i=0; i < allLines.length; i++) {
					pilex.add(function createParser(next) {

	//					console.log("Entered pile");

						var lineParser = new Worker("./utils/workers/AddScoreParser.js");

						lineParser.postMessage({"lines": allLines[lineCounter]});
						lineCounter++;

						lineParser.addListener("message", function (msg) {
							sys.puts(msg.out.join("\n"));
	//						sys.puts(msg.out.length);
							lineParser.terminate();
							lineParser.kill();
							next();
						});
					});
				}
*/			
	//			var beginTime = new Date().getTime();
	//			pilex.run(function() { console.log("Completed in " + (new Date().getTime() - beginTime) / 1000 + " seconds with " + cores + " threads."); }, cores);
//				pilex.run(function() {allLines = []; callback(null, ""); }, cores);
			});
			
		} else {
			return callback(new Error("The path to SAM file '" + pathToSAM + "' does not exist."));		
		}
	
	});

}

function trim(string) {
    return string.replace(/^\s*|\s*$/, '');
}
