#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var scoreCalculator = require("./CalculateAlignmentScore");
var fileLineReader = require("./FileLineReader");
var cores = require("os").cpus().length;
var Worker = require("../node_modules/worker").Worker;

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

var allLines = [];
var lineCounter = 0;

var Pile = function() {
   this.pile = [];
   this.concurrency = 0;
   this.done = null;
   this.max_concurrency = 5;
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


//Returns callback(error, newSAMFilePath)
function addScoreToSAM(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	path.exists(samFilePath, function(exists) {
		if (exists) {
			var lineReader = fileLineReader.FileLineReader(samFilePath, 1024 * 128);
			var line = null;

			var pilex = new Pile();
			var linesPerParser = 20000;
			var lines = [];
				
			while (true) {
				line = lineReader.nextLine();
				
				if (line.substr(0, 3) === "@SQ" || line.substr(0,3) === "@PG" || line.substr(0,3) === "@RG" || line.substr(0,3) === "@HD") {
					sys.puts(line);
				} else {

                    lines.push(line);
                    if (lines.length === linesPerParser) {
						allLines.push(lines);
						lines = [];
					}

				}

				if (!lineReader.hasNextLine()) {
					allLines.push(lines);
					break;
				}
			}

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
//						lineParser.kill();
						next();
					});
				});
			}
//			var beginTime = new Date().getTime();
//			pilex.run(function() { console.log("Completed in " + (new Date().getTime() - beginTime) / 1000 + " seconds with " + cores + " threads."); }, cores);
			pilex.run(function() { callback(null, ""); }, cores);
			
			
		} else {
			return callback(new Error("The path to SAM file '" + pathToSAM + "' does not exist."));		
		}
	
	});

}

