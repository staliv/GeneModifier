#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("./FileLineReader")
var positionBackMapper = require("../PositionBackMapper");

//var log4js = require("log4js")();
//log4js.configure("../logs/config.json");

//Accepts a .sam file processed from a modified genome and outputs a file with modified coordinates
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 14, process.argv[1].length) == "/RewriteSAM.js") {
	if (process.argv.length <= 2) {
		sys.puts("Accepts a *.sam file processed from a modified genome and outputs a file with correct coordinates coordinates.\nExample usage: 'node RewriteSAM.js samFilePath'");
	}
	else {
		rewriteSAM(process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			sys.puts(message);
		});
	}
}

exports.rewriteSAM = rewriteSAM;

//Returns callback(error, message)
function rewriteSAM(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	path.exists(samFilePath, function(exists) {
		if (exists) {
			var lineReader = fileLineReader.FileLineReader(samFilePath);
			var keys = {};
			var keysArray = [];
			var output = [];
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
						chromosomeSize: null
					};
					keysArray.push(key);
				} else {
					//Break after reading keys
					break;
				}
			}

			//Get chromosome size for each key
			getChromosomeSizes(keysArray, keys, function(keys) {
//				console.dir(keys);
				for (var i = 0; i < keysArray.length; i++) {
					output.push("@SQ\tSN:" + keys[keysArray[i]].chromosome + "\tLN:" + keys[keysArray[i]].chromosomeSize + "\n");
					
				}

				var count = 0;
				
				while (lineReader.hasNextLine()) {
					line = line.split("\t");

					//Exclude reads that did not match
					if (!(parseInt(line[1]) & 4)) {

						count++;
						
						//Parse each line
						parseLine(line, keys, function(modifiedLine) {
//							output.push(modifiedLine);
							if (modifiedLine !== "") {
								sys.puts(modifiedLine)
							}
							--count;
							if (count === 0) {
								//TODO: Better callback
								callback(null, "Done");
//								callback(null, output.join(""));
							}
						});
					}

					line = lineReader.nextLine();
				}

			});

		}
		else {
			return callback(new Error("The file: " + samFilePath + " does not exist."));
		}
	});

}

function parseLine(line, keys, next) {

	var modifiedLine = [];
	var key = keys[line[2]];
	var noReturn = false;

	//QNAME is always the same
	modifiedLine.push(line[0]);
	//FLAG is always the same
	modifiedLine.push(line[1]);

	//RNAME should match the reference sequence name (SN in header, ie chromosome name) 
	modifiedLine.push(key.chromosome);

	//POS should be backmapped from (modified genome startPosition + position in sam)
	positionBackMapper.backMap("genes/modified/" + key.gene + "_" + key.changeset + ".fa", key.startPosition + parseFloat(line[3]), function(error, referencePosition) {
		if (error) return error.message;
		modifiedLine.push(referencePosition);

		//MAPQ stays the same 
		//TODO: Maybe change in the future
		modifiedLine.push(line[4]);
	
		//TODO: CIGAR should be modified if anything has changed inside the modified genome
		var changes = changesMade(key, referencePosition, line[9].length);
		if (changes.length > 0 && 
			line[5] !== "75M") { //Debug
			modifiedLine.push(line[5] + " -> [" + changes.toString() + "]");
		}
		//Debug
		else if (line[5] !== "75M") {
			modifiedLine.push(line[5]);
		}
		else {
			noReturn = true;
			modifiedLine.push(line[5]);
		}
	
		//RNEXT stays the same
		modifiedLine.push(line[6]);
	
		//PNEXT stays the same
		modifiedLine.push(line[7]);
		
		//TLEN stays the same
		modifiedLine.push(line[8]);
	
		//SEQ stays the same
		modifiedLine.push(line[9]);
	
		//QUAL stays the same
		modifiedLine.push(line[10]);
	
		//Handle optional fields
		for (var i = 11; i < line.length; i++) {
			var tag = line[i].split(":")[0];
			
			switch (tag) {
				//TODO: Alternative hits; format: (chr,pos,CIGAR,NM;)?
				case 'XA':
					modifiedLine.push(line[i]);
					break;
				//TODO: Edit distance; should match the number of changes made to accept the sequence
				case 'NM':
					modifiedLine.push(line[i]);
					break;
				//TODO: Mismatching positions/bases should be modified
				case 'MD':
					modifiedLine.push(line[i]);
					break;
				//Default to add the tag as it is
				default:
					modifiedLine.push(line[i]);
					break;
			}
		}
		
		//Return concatenated line with LF
		if (noReturn) {
			next("");
		}
		else {
			next(modifiedLine.join("\t"));
		}
	
	});
}


var _changeSets = {};

function changesMade(key, position, sequenceLength) {
	//Open corresponding changeset and see if anything was modified on this sequence
	if (_changeSets[key.changeset] === undefined) {
		_changeSets[key.changeset] = fs.readFileSync("changesets/" + key.changeset, "ascii");
	}
	var changeSet = _changeSets[key.changeset].split("\n");
	var changes = [];
	for (var i = 0; i < changeSet.length; i++) {
		var sets = changeSet[i].split("\t");
		//if 
		//	correct chromosome
		//	AND ((startPosition >= position AND startPosition <= (position + sequenceLength))
		//	OR (endPosition >= position AND endPosition <= (position + sequenceLength)))
		
		if (sets[0] === key.chromosome 
			&& (
				(parseFloat(sets[1]) >= position && parseFloat(sets[1]) <= (position + sequenceLength))
				|| (parseFloat(sets[2]) >= position && parseFloat(sets[2]) <= (position + sequenceLength))
				)
			) {
			changes.push([sets[0], sets[1], sets[2], sets[3]]);
		}
	}
	return changes;
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
				size = size - chromosomeName.length - 2;
				
				//Remove all LF bytes
				size = size - ((size - (size % 51)) / 51) - 1;
				next(size);
			});
		}
		else {
			next(0);
		}
	});
}