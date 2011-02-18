#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var prepareForIndexing = require("./utils/PrepareForIndexing");

var log4js = require("./node_modules/log4js")();
log4js.configure("./logs/config.json");

var geneFetcher = require("./GeneFetcher");

//Accepts the name of the gene and changeset from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 16, process.argv[1].length) == "/GeneModifier.js") {
	if (process.argv.length <= 3) {
		sys.puts("Example usage: 'node GeneModifier.js geneName changeSetName'");
	}
	else {
		modifyGene(process.argv[process.argv.length - 2], process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			sys.puts(message);
		});
	}
}

exports.modifyGene = modifyGene;

//Returns callback(error, message)
function modifyGene(geneName, changeSetName) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};
	
	//Return with error if arguments are not correctly passed
	if (!geneName || !changeSetName) return callback(new Error("Missing name of gene or changeSet"));

	//If geneName includes a forward slash then assume the whole filename was provided Else assume gene is located in ./genes/
	var genePath = (geneName.split("/").length > 0) ? geneName : "./genes/" + geneName.replace(".fa", "").toUpperCase() + ".fa";

	//If changeSetName includes a forward slash then assume the whole filename was provided Else assume changeset is located in ./changesets/
	var changeSetPath = (changeSetName.split("/").length > 0) ? changeSetName : "./changesets/" + changeSetName.replace(".cs", "") + ".cs";
		
	//TODO: Rewrite according to async pattern 
	//Does gene already exist?
	path.exists(genePath, function (exists) {
		if (!exists) {
			//Otherwise fetch gene
			geneFetcher.fetchGene(geneName, function(error, filePath) {
				if (error) return callback(error);
				//Try again with the same callback
				modifyGene(filePath, changeSetName, callback);
			});
		}
		else {
			//Does changeSet exist?
			path.exists(changeSetPath, function (exists) {
				if (!exists) {
					return callback(new Error("ChangeSet " + changeSetPath + " does not exist."));
				}
				mergeGeneAndChangeSet(genePath, changeSetPath, function(error, returnValue) {
					if (error) return callback(error);

					callback(null, returnValue);
				});
			});
		}
	});
}

//Returns callback(error, returnValue)
function mergeGeneAndChangeSet(genePath, changeSetPath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	var firstBytes = "";
	
	//Read first 1024 bytes from geneFile, determine chromosome and interval
	var geneStream = fs.createReadStream(genePath, {
		'bufferSize': 1024, encoding: 'utf8', 'start': 0, 'end': 1024
	});
	geneStream.on("data", function(chunk) {
		firstBytes += chunk;
	});
	geneStream.on("end", function() {

		var chromosomeName = null, 
			chromosomeInterval = null,
			firstRow = firstBytes.split("\n")[0],
			firstRowLength = firstRow.length;
		
		//Extract name of chromosome and interval from gene file
		chromosomeName = firstRow.split(" ")[1].split(":")[0];
		chromosomeInterval = {start: parseFloat(firstRow.split(" ")[1].split(":")[1].split("-")[0]), stop: parseFloat(firstRow.split(" ")[1].split(":")[1].split("-")[1])};

		//Proceed with the merging
		fs.readFile(changeSetPath, "utf8", function(error, changeSet) {
			if (error) return callback(error);
			
			_createMergedGene(genePath, changeSet, chromosomeName, chromosomeInterval, firstRowLength + 1, function(errors, mergedGene, offsetDescriptor) {
				if (errors) {

//					for (var i = 0; i < errors.length; i++) {
//						console.error(errors[i].message);
//					}
					
					return callback(errors);

				}
				
				//TODO: Make async
				var mergedFile = fs.openSync("./genes/modified/" + path.basename(genePath, ".fa") + "_" + path.basename(changeSetPath) + ".fa", "w");
				fs.writeSync(mergedFile, firstRow.replace(" ", "::") + "::" + path.basename(changeSetPath) + "\n" + mergedGene.join(''));
				fs.closeSync(mergedFile);

				var offsetDescriptorFile = fs.openSync("./genes/modified/" + path.basename(genePath, ".fa") + "_" + path.basename(changeSetPath) + ".offsets", "w");
				fs.writeSync(offsetDescriptorFile, offsetDescriptor.join("\n"));
				fs.closeSync(offsetDescriptorFile);

				//Prepare gene for indexing (inserts line breaks)
				prepareForIndexing.prepareForIndexing("./genes/modified/" + path.basename(genePath, ".fa") + "_" + path.basename(changeSetPath) + ".fa", function(error, fileName) {
					if (error) {
						return callback(error);
					}
					callback(null, fileName);
				});
				
			});
		});

	});
}

//Returns callback(errors[], mergedGene[], offsetDescriptor[])
function _createMergedGene(genePath, changeSet, chromosomeName, chromosomeInterval, offset) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	var changeRows = changeSet.split("\n");
	var errors = [];
	
	var conflict = {}, recentlySkippedRows = 0;
	
	//TODO: Make sure changeset is correctly ordered

	//Check changeset for changes that conflict with each other
	for (var i = 0; i < changeRows.length; i++) {
		if (changeRows[i] !== "" && changeRows[i].substr(0, 1) !== "#") {
			var chr = changeRows[i].split("\t")[0];
			if (conflict[chr] === undefined) {
				conflict[chr] = [];
			}
			for (var x = parseFloat(changeRows[i].split("\t")[1]); x < parseFloat(changeRows[i].split("\t")[2]); x++) {
				if (conflict[chr].indexOf(x) !== -1) {
					//We have a conflict, skip this row
					console.error("Row " + (i + 1 + recentlySkippedRows) + " has a conflicting changeset.");
					changeRows.splice(i, 1);
					recentlySkippedRows++;
					break;
				} else {
					conflict[chr].push(x);
				}
			}
			//Deletions
			if (parseFloat(changeRows[i].split("\t")[1]) === parseFloat(changeRows[i].split("\t")[2])) {
				if (conflict[chr].indexOf(parseFloat(changeRows[i].split("\t")[1])) !== -1) {
					//We have a conflict, skip this row
					console.error("Row " + (i + 1 + recentlySkippedRows) + " has a conflicting changeset. Skipping row.");
					changeRows.splice(i, 1);
					recentlySkippedRows++;
				} else {
					conflict[chr].push(parseFloat(changeRows[i].split("\t")[1]));
				}
			
			}
			
		}
	}

	if (recentlySkippedRows > 0) {
		//Changeset must be fixed
		return callback(new Error("The changeset has conflicts, please fix before trying to modify the gene."));
	}

	var i = 0, nrOfRows = changeRows.length;

	//Open gene for reading
	var geneFile = fs.openSync(genePath, "r");
	
	var output = [],
		offsetDescriptor = [[chromosomeInterval.start,0]],
		insertionsDescriptor = [],
		position = offset,
		bytesRead = 0,
		deletionsLength = 0,
		insertionsLength = 0;
	
	// changeRows.forEach(function(row) {
	//TODO: Make async?
	for (i; i < nrOfRows; i++) { 

		var row = changeRows[i];

		//Skip rows that are commented out
		if (row.length > 0 && row.substr(0, 1) !== "#") {
			var changeValues = row.split("\t");

			//Check if correct number of changeValues
			if (changeValues.length < 4) { 
//				errors.push(new Error("Skipping changeSet row '" + row + "', not enough information in description"));
				continue;
			}

			//Check if correct chromosome
			if (changeValues[0] !== chromosomeName) {
//				errors.push(new Error("Skipping changeSet row '" + row + "', non matching gene, expected " + chromosomeName + " found " + changeValues[0]));
				continue;
			}

			//Check if interval is suitable
			if (parseFloat(changeValues[1]) >= chromosomeInterval.start && parseFloat(changeValues[2]) <= chromosomeInterval.end) {
//				errors.push(new Error("Skipping changeSet row '" + row + "', non matching interval"));
				continue;
			}
			
			var command = changeValues[3].substr(0, 1),
				change = "",
				difference = 0;
			
			var read = null, readLength = 0;

			switch (command) {
				case 'S':
					change = changeValues[3].split("-")[1];
//					console.debug("Substitute " + changeValues[1] + " to " + changeValues[2] + " with " + change);
					//Read (start - chromosomeInterval.start) - bytesRead) bytes from last position in geneFile to output, add substitution, move change.length bytes and output to writestream
					readLength = (parseFloat(changeValues[1]) - chromosomeInterval.start - bytesRead);
					if (readLength > 0) {
						read = fs.readSync(geneFile, readLength, position, 'utf8');
						bytesRead += read[1];
						output.push(read[0]);
						position += read[1];
					}
					output.push(change);
					position += change.length;
					bytesRead += change.length;
					break;
				case 'D':
//					console.debug("Delete " + changeValues[1] + " to " + changeValues[2]);
					//Read (start - chromosomeInterval.start) - position) bytes from last position in geneFile to output, move position deletion.length bytes forward
					readLength = (parseFloat(changeValues[1]) - chromosomeInterval.start - bytesRead);
					if (readLength > 0) {
						read = fs.readSync(geneFile, readLength, position, 'utf8');
						bytesRead += read[1];
						output.push(read[0]);
						position += read[1];
					}
					difference = (parseFloat(changeValues[2]) - parseFloat(changeValues[1]));
					position += difference;
					bytesRead += difference;
					//[start + previousInsertionLengths, previousOffset + (end - start)]
					offsetDescriptor.push([parseFloat(changeValues[1]) - deletionsLength + insertionsLength, offsetDescriptor[offsetDescriptor.length - 1][1] + difference]);
					deletionsLength += difference;
					break;
				case 'I':
					change = changeValues[3].split("-")[1];
//					console.debug("Insert " + change + " to " + changeValues[1]);
					//Read (start - chromosomeInterval.start) - position) bytes from last position in geneFile to output, add insertion, move change.length bytes and output to writestream
					readLength = (parseFloat(changeValues[1]) - chromosomeInterval.start - bytesRead);
					if (readLength > 0) {
						read = fs.readSync(geneFile, readLength, position, 'utf8');
						bytesRead += read[1];
						output.push(read[0]);
						position += read[1];
					}
					output.push(change);
					//Mark insertions back to where the insertion started
					var backMapPosition = offsetDescriptor[offsetDescriptor.length - 1][1] - change.length;
//					for (var x = 0; x < change.length; x++) {
//						offsetDescriptor.push([parseFloat(changeValues[1]) - deletionsLength + insertionsLength + x - change.length, backMapPosition]);
//						insertionsLength++;
//					}
					for (var x = 0; x < change.length; x++) {
						offsetDescriptor.push([parseFloat(changeValues[1]) - deletionsLength + insertionsLength, backMapPosition]);
						insertionsLength++;
					}
					break;
			}
		}
	}
	//);
	
	//Push the rest of the gene to output
	output.push(fs.readSync(geneFile, (fs.fstatSync(geneFile).size - bytesRead), position, 'utf8')[0]);

	//Close file
	fs.closeSync(geneFile);

	callback((errors.length === 0) ? null : errors, output, offsetDescriptor);
}