#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("./FileLineReader");
var exec = require("child_process").exec;
var settings = require("../settings").settings;

var Worker = require("../node_modules/worker").Worker;

//var log4js = require("log4js")();
//log4js.configure("../logs/config.json");

//Accepts a .sam file processed from a modified genome and outputs a file with modified coordinates
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 22, process.argv[1].length) == "/RewriteSAMParallel.js") {
	if (process.argv.length <= 2) {
		sys.puts("Accepts a *.sam file processed from a modified genome and outputs a file with correct(ish) coordinates.\nExample usage: 'node RewriteSAMParallel.js samFilePath'");
	}
	else {
		rewriteSAM(process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				console.error(error);
				console.dir(error);
				return;
			}
//			sys.puts("Done");
		});
	}
}

var allLines = [];
var lineCounter = 0;
var keys = {};

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
		var that = this;
		var next = function() {
			that.concurrency--;
			(--target === 0) ? that.done() : that.run();
		};
		while(this.concurrency < this.max_concurrency && this.pile.length > 0) {
			this.concurrency++;
			var callback = this.pile.shift();
			callback(next);
		}
	}
};
var parseCount = 0;
var filesToParse = [];
var pileFiles = new Pile();
var nrOfLines = 0;
function rewriteSAM(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	exec("wc -l " + samFilePath, function(error, stdout, stderr) {
		if (error) {return callback(error); }

		nrOfLines = parseFloat(trim(stdout).split(" ")[0]);

		splitToFiles(samFilePath, function(error, files) {
			if (error) {return callback(error); }

			filesToParse = files;
		
			filesToParse.forEach(function(element, i) {

				pileFiles.add(function parseFile(next) {
					parseCount++;
					sys.error("Parsing " + filesToParse[i][0] + "...");
					rewriteSAMFile(filesToParse[i][0], function(error, message) {
						if (error) {return callback(error); }
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
var keysArray = [];

//Returns callback(error, message)
function rewriteSAMFile(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	path.exists(samFilePath, function(exists) {
		if (exists) {
			var lineReader = fileLineReader.FileLineReader(samFilePath, 1024 * 128);
			var line = null;
			while (lineReader.hasNextLine()) {
				line = lineReader.nextLine();
				if (line.substr(0,3) === "@SQ") {
					//Found key
					var key = line.split("\t")[1].replace("SN:", "");
					keys[key] = {
						gene: key.split("::")[0], 
						chromosome: key.split("::")[1].split(":")[0], 
						startPosition: parseFloat(key.split("::")[1].split(":")[1].split("-")[0]), 
						stopPosition: parseFloat(key.split("::")[1].split(":")[1].split("-")[1]), 
						changeset: key.split("::")[2],
						chromosomeSize: ""
					};
					keysArray.push(key);
				} else if (line.substr(0,3) === "@PG" || line.substr(0,3) === "@RG" || line.substr(0,3) === "@HD") {

				} else {
					//Break after reading keys
					break;
				}
			}

			//Keys must be sorted according to chromosome name
/*
			var sortKeys = function(a, b) {
				var chromosomeNameA = a.split("::")[1].split(":")[0].toLowerCase(), chromosomeNameB = b.split("::")[1].split(":")[0].toLowerCase();
				
				if (chromosomeNameA < chromosomeNameB) {
					return -1;
				}
				if (chromosomeNameA > chromosomeNameB) {
					return 1;
				}
				return 0;
			};

			keysArray.sort(sortKeys);
*/
			//Get chromosome size for each key
//			getChromosomeSizes(keysArray, keys, function(keys) {
				//console.dir(keys);
				
//				for (var i = 0; i < keysArray.length; i++) {
//					sys.puts("@SQ\tSN:" + keys[keysArray[i]].chromosome + "\tLN:" + keys[keysArray[i]].chromosomeSize);
//				}

				var pilex = new Pile();
                var linesPerParser = 20000;
                var lines = [];
                var splitLine = null;
				var lineIteratorCount = 0;
				while (true) {
					splitLine = line.split("\t");
					lineIteratorCount++;
					if (!(parseInt(splitLine[1], 10) & 4)) {

                        lines.push(line);
                        if (lines.length === linesPerParser) {
							allLines.push(lines);
							lines = [];
						}
					}
					if (lineReader.hasNextLine()) {
						line = lineReader.nextLine();
					} else {
						allLines.push(lines);
						//Exit infinite while loop when all lines are read
						break;
					}

				}

//				sys.error("Iterated " + lineIteratorCount + " lines.");
				for (var i=0; i < allLines.length; i++) {
					pilex.add(function createParser(next) {

						var lineParser = new Worker("./utils/workers/SAMLineParser.js");

//						sys.error("Sent " + allLines[lineCounter].length) + " lines.";
						lineParser.postMessage({"lines": allLines[lineCounter], "keys": keys});
						lineCounter++;

/*
						lineParser.onmessage = function (msg) {
							sys.puts(msg.out.join("\n"));
							lineParser.terminate();
							next();
						};
*/							
						lineParser.addListener("message", function (msg) {
//							sys.error("Got " + msg.out.length + " lines.");
							sys.puts(msg.out.join("\n"));
							lineParser.terminate();
							lineParser.kill();
							next();
						});
						lineParser.on("error", function (error) {
//							sys.error("Got " + msg.out.length + " lines.");
							sys.error("lineParser returned error: " + error.message);
							lineParser.terminate();
							lineParser.kill();
							next();
						});
					});
				}
//				var beginTime = new Date().getTime();
				var threads = require("os").cpus().length;
//				pilex.run(function() {console.log("Completed in " + (new Date().getTime() - beginTime) / 1000 + " seconds with " + threads + " threads.")}, threads);
				pilex.run(function() {allLines = []; lineCounter = 0; callback(null, "OK");}, threads);
				
		} else {
			return callback(new Error("The file: " + samFilePath + " does not exist."));
		}
	});

}

function splitToFiles(samFile, callback) {
	
	var maxNumberOfLines = Math.round((nrOfLines / 3));
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
		var splitCounter = 0;
		var splitFiles = [];
		
//		for (var i=0; i < splits.length; i++) {
//		splits.forEach(function(element, i) {
		var i = 0;
//			splitCounter++;
		splitFiles[i] = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".split" + i + ".sam";
		
		exec("head -n " + ((splits[0] * i) + splits[i]) + " " + samFile + " | tail -n " + splits[i] + " > " + splitFiles[i], function(error, stdout, stderr) {
			if (error) {return callback(error); }
			if (stderr) {sys.error(stderr); }
			files[i] = [splitFiles[i], splits[i]];
			sys.error(i + " : " + (splits.length - 1));
//			--splitCounter;
			i = 1;
			splitFiles[i] = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".split" + i + ".sam";
			exec("head -n " + ((splits[0] * i) + splits[i]) + " " + samFile + " | tail -n " + splits[i] + " > " + splitFiles[i], function(error, stdout, stderr) {
				if (error) {return callback(error); }
				if (stderr) {sys.error(stderr); }
				files[i] = [splitFiles[i], splits[i]];
				sys.error(i + " : " + (splits.length - 1));
//				--splitCounter;

				i = 2;
				splitFiles[i] = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".split" + i + ".sam";
				exec("head -n " + ((splits[0] * i) + splits[i]) + " " + samFile + " | tail -n " + splits[i] + " > " + splitFiles[i], function(error, stdout, stderr) {
					if (error) {return callback(error); }
					if (stderr) {sys.error(stderr); }
					files[i] = [splitFiles[i], splits[i]];
					sys.error(i + " : " + (splits.length - 1));
	//				--splitCounter;

					if (splits.length === 4) {
						i = 3;
						splitFiles[i] = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".split" + i + ".sam";
						exec("head -n " + ((splits[0] * i) + splits[i]) + " " + samFile + " | tail -n " + splits[i] + " > " + splitFiles[i], function(error, stdout, stderr) {
							if (error) {return callback(error); }
							if (stderr) {sys.error(stderr); }
							files[i] = [splitFiles[i], splits[i]];
							sys.error(i + " : " + (splits.length - 1));
		//					--splitCounter;
							sys.error("Splitted to " + files.length + " files.");
							callback(null, files);

						});
					}else {
					
	//				if (splitCounter === 0) {
						sys.error("Splitted to " + files.length + " files.");
						callback(null, files);
					}
				});
			});
		});
//		});
		
	} else {
		files.push([samFile, nrOfLines]);
		callback(null, files);
	}
}

function trim(string) {
    return string.replace(/^\s*|\s*$/, '');
}

function getChromosomeSizes(keysArray, keys, next) {

	var count = keysArray.length;

	keysArray.forEach(function(key) {
		getChromosomeSize(keys[key].chromosome, null, function(size) {
			keys[key].chromosomeSize = size;
			count--;
			if (count <= 0) {
				next(keys);
			}
		});
	});
}


//Returns callback(chromosomeSize)
function getChromosomeSize(chromosomeName, databaseName, next) {

	if (!databaseName) databaseName = "hg18";
	path.exists("chromosomes/" + chromosomeName + ".fa", function(exists) {
		if (exists) {
			fs.stat("chromosomes/" + chromosomeName + ".fa", function(error, stats) {
				if (error) return 0;
				var size = stats.size;

				//Remove first line size and LF
				size = size - chromosomeName.length - 1;
				
				//Remove all LF bytes
				size = size - ((size - (size % 51)) / 51) - 1;
				next(size);
			});
		}
		else {
			console.error("Chromosome " + chromosomeName + " does not exist.");
			next(0);
		}
	});
}

exports.rewriteSAM = rewriteSAM;
