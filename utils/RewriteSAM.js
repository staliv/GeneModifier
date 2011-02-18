#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("./FileLineReader");
var scoreCalculator = require("./CalculateAlignmentScore");
var positionBackMapper = require("../PositionBackMapper");
var exec = require("child_process").exec;

var exonerate = "exonerate";

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
			//sys.puts(message);
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

			//Keys must be sorted according to chromosome name
			var sortKeys = function(a, b) {
				var chromosomeNameA = a.split("::")[1].split(":")[0].toLowerCase(), chromosomeNameB = b.split("::")[1].split(":")[0].toLowerCase();
				
				if (chromosomeNameA < chromosomeNameB) {
					return -1;
				}
				if (chromosomeNameA > chromosomeNameB) {
					return 1;
				}
				return 0;
			}

			keysArray.sort(sortKeys);

			//Get chromosome size for each key
			getChromosomeSizes(keysArray, keys, function(keys) {
				//console.dir(keys);
				
				for (var i = 0; i < keysArray.length; i++) {
					output.push("@SQ\tSN:" + keys[keysArray[i]].chromosome + "\tLN:" + keys[keysArray[i]].chromosomeSize);
				}

				var count = 0;
				
				sys.puts(output.join("\n"));
				
				while (true) {
					line = line.split("\t");
//					console.log(line);
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
								callback(null, "");
//								callback(null, output.join(""));
							}
						});
					}

					if (lineReader.hasNextLine()) {
						line = lineReader.nextLine();
					} else {
						//Exit infinite while loop when all lines are read
						break;
					}
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
	var isReverseComplemented = (line[1] & 16);

	//QNAME is always the same
	modifiedLine.push(line[0]);
	//FLAG is always the same
	modifiedLine.push(line[1]);

	//RNAME should match the reference sequence name (SN in header, ie chromosome name) 
	modifiedLine.push(key.chromosome);

	var SAMPositionZeroBased = (parseFloat(line[3]) - 1);
	//POS should be backmapped from (modified genome startPosition + position in sam)
	positionBackMapper.backMap("genes/modified/" + key.gene + "_" + key.changeset + ".fa", key.startPosition + SAMPositionZeroBased, function(error, referencePosition) {
		if (error) return error.message;

		var changes = changesMade(key, referencePosition, line[9].length);

/*
		//Sometimes deletions should be added to reference position, not sure why
		for (var i = 0; i < changes.length; i++) {
			if (changes[i][3].substr(0, 1) == "D") {
				referencePosition += (parseFloat(changes[i][2]) - parseFloat(changes[i][1]))
			}
		}
*/
		//SAM format is 1-based
		modifiedLine.push(referencePosition + 1);
//		modifiedLine.push(referencePosition + 1 + " was " + (key.startPosition + SAMPositionZeroBased));

		//MAPQ stays the same 
		//TODO: Maybe change MAPQ in the future
		modifiedLine.push(line[4]);
	

		//CIGAR should be modified if anything has changed inside the modified genome
		if (changes.length > 0) {
		
			//Create file containing reference genome that matches the first position of the modified genome
			var reference = createReferenceFile(line[9], key.chromosome, referencePosition, changes);
			//Create file containing the sequence that is aligned
			var sequenceFileName = "./tmp/seq_" + line[9] + "_" + new Date().getTime() + ".fa";
			var sequenceFile = fs.openSync(sequenceFileName, "w");

			fs.writeSync(sequenceFile, ">Sequence\n" + line[9], 0, "ascii");
			fs.closeSync(sequenceFile);

			//Call exonerate and fetch CIGAR
			var child = exec(exonerate + " -n 1 --showcigar --exhaustive --model affine:global --showalignment 1 " + sequenceFileName + " " + reference.fileName, function (error, stdout, stderr) {

				if (error) {
					//Breakpoint insertion for debugging
					error = error;
				}

//				sys.puts(stdout);
				var alignment = stdout.split("\n");
				var cigar = "", oldCigar = line[5];
				var rawScore = "";
				var editDistance = 0;
				var mismatches = "", oldMismatches = null;
				var exonerateSequence = "", exonerateReference = "";
				
				for (var i = 0; i < alignment.length; i++) {
					if (alignment[i].indexOf("Raw score: ") !== -1) {
						rawScore = alignment[i].split(": ")[1];
					}
					if (alignment[i].indexOf("cigar:") !== -1) {
						cigar = alignment[i].split(rawScore)[1].replace(/ /g, "");
						cigar = reverseCIGAR(cigar);
						break;
					}
					if (alignment[i].substr(0, 5) === "  1 :") {
						if (exonerateSequence === "") {
							exonerateSequence += alignment[i].substr(6, alignment[i].lastIndexOf(":") - 7);
							exonerateSequence += alignment[i + 4].substr(6, alignment[i + 4].lastIndexOf(":") - 7);
						} else {
							exonerateReference += alignment[i].substr(6, alignment[i].lastIndexOf(":") - 7);
							exonerateReference += alignment[i + 4].substr(6, alignment[i + 4].lastIndexOf(":") - 7);
						}
						mismatches += alignment[i + 1].substr(6, alignment[i + 1].length - 6);
						mismatches += alignment[i + 5].substr(6, alignment[i + 5].length - 6);
					}
					
				}
				//Set CIGAR
				modifiedLine.push(cigar);
//				modifiedLine.push(line[5] + "->" + cigar +  " [" + changes.toString() + "]");

				//Remove the temporary files
				fs.unlinkSync(reference.fileName);
				fs.unlinkSync(sequenceFileName);

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

				//EDIT DISTANCE
				var editDistance = calculateEditDistance(line[9], reference.sequence);
				modifiedLine.push("NM:i:" + editDistance);

				var md = "";
				if (editDistance > 0) {
					//MD:Z Mismatching positions/bases should be calculated
					md = calculateMismatches(mismatches, exonerateSequence, exonerateReference);
					modifiedLine.push("MD:Z:" + md);
				} else {
					modifiedLine.push("MD:Z:75");
				}
			
				var XA = null;
			
				//Handle optional fields
				for (var i = 11; i < line.length; i++) {
					var tag = line[i].split(":")[0];
					
					switch (tag) {
						//TODO: Alternative hits; format: (chr,pos,CIGAR,NM;)?
						case 'XA':
							//TODO: Must calculate XA!
							XA = line[i];
//							modifiedLine.push(line[i]);
							break;
						//Do not add edit distance here
						case 'NM':
							break;
						//Do not add mismatching positions/bases here
						case 'MD':
//							modifiedLine.push("Old:" + line[i]);
							oldMismatches = line[i].split(":");
							oldMismatches = oldMismatches[oldMismatches.length - 1];
							break;
						//Default to add the tag as it is
						default:
							modifiedLine.push(line[i]);
							break;
					}
				}

				
				modifiedLine.push("YM:i:" + scoreCalculator.getAlignmentScore(oldCigar, oldMismatches));

				//Debug
/*				if (cigar !== "75M") {
					console.log(stdout);
//					console.log(mismatches);
					next(modifiedLine.join("\t"));
				} else {
					next("");
				}
*/
/*				if (XA) {
					rewriteAltHits(XA, line[9], isReverseComplemented, function (error, altHits) {
						modifiedLine.push("XA:Z:" + altHits);
						next(modifiedLine.join("\t"));
					});
				} else {
*/
				next(modifiedLine.join("\t"));
//				}

			});			

		}
		else {
		
			var oldMismatches = null;
			//Set CIGAR
			modifiedLine.push(line[5]);

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

			var XA = null;
		
			//Handle optional fields
			for (var i = 11; i < line.length; i++) {
				var tag = line[i].split(":")[0];
				
				switch (tag) {
					//TODO: Alternative hits; format: (chr,pos,CIGAR,NM;)?
					case 'XA':
						XA = line[i];
//						modifiedLine.push("XA:Z:" + rewriteAltHits(line[i], line[9]));
						break;
					//Edit distance; should match the number of changes made to accept the sequence
					case 'NM':
						modifiedLine.push(line[i]);
						break;
					//TODO: Mismatching positions/bases should be modified
					case 'MD':
						//Fetch mismatches for calculating score
						oldMismatches = line[i].split(":");
						oldMismatches = oldMismatches[oldMismatches.length - 1];
						modifiedLine.push(line[i]);
						break;
					//Default to add the tag as it is
					default:
						modifiedLine.push(line[i]);
						break;
				}
			}

			//Output score to current line
			modifiedLine.push("YM:i:" + scoreCalculator.getAlignmentScore(line[5], oldMismatches));

/*			if (XA) {
				rewriteAltHits(XA, line[9], isReverseComplemented, function (error, altHits) {
					modifiedLine.push("XA:Z:" + altHits);
					next(modifiedLine.join("\t"));
				});
			} else {
*/
			next(modifiedLine.join("\t")); //"\n"
//			}
//			next(""); //"\n"

		}
	
	
	});
}
/*
function rewriteAltHits(altDescription, sequence, isReverseComplemented, callback) {

	var alternativeHits = altDescription.substr(5, altDescription.length - 5).split(";");
	var altConcat = [];
	
	//Alternative hits; format: (geneName::chromosomeName:chromosomeIntervalStart-End::changeset.cs,pos,CIGAR,Edit distance;)
	
	for (var i = 0; i < alternativeHits.length - 1; i++) {
		var geneName = alternativeHits[i].split(",")[0].split("::")[0];
		var chromosomeName = alternativeHits[i].split(",")[0].split("::")[1].split(":")[0];
		var startPosition = parseFloat(alternativeHits[i].split(",")[0].split("::")[1].split(":")[1].split("-")[0]);
		var changeSetName = alternativeHits[i].split(",")[0].split("::")[2];
		var oldPosition = parseFloat(alternativeHits[i].split(",")[1]) - 1;
		var negativeStrand = false;
		if (oldPosition < 0) {
			negativeStrand = true;
			oldPosition = oldPosition * (-1);
//			oldPosition = parseFloat(alternativeHits[i].split(",")[0].split("::")[1].split(":")[1].split("-")[1]) - oldPosition - sequence.length;
			oldPosition = oldPosition + startPosition;
		} else {
			oldPosition = oldPosition + startPosition;
		}
		
		//Backmap position
		positionBackMapper.backMap("genes/modified/" + geneName + "_" + changeSetName + ".fa", oldPosition, function(error, referencePosition) {

			if (error) { throw error;}

			//Create files for exonerate
			//Create file containing reference genome that matches the first position of the modified genome
			var reference = createReferenceFile(sequence, chromosomeName, referencePosition, negativeStrand, isReverseComplemented);
			//Create file containing the sequence that is aligned
			var sequenceFileName = "./tmp/seq_" + sequence + "_" + new Date().getTime() + ".fa";
			var sequenceFile = fs.openSync(sequenceFileName, "w");

			fs.writeSync(sequenceFile, ">Sequence\n" + sequence, 0, "ascii");
			fs.closeSync(sequenceFile);

			//Run exonerate to calculate edit distance
			var child = exec("exonerate -n 1 --showcigar --exhaustive --model affine:global --showalignment 1 " + sequenceFileName + " " + reference.fileName, function (error, stdout, stderr) {

				//Remove the temporary files
				fs.unlinkSync(reference.fileName);
				fs.unlinkSync(sequenceFileName);

//				sys.puts(stdout);

				var alignment = stdout.split("\n");
				var cigar = "";
				var rawScore = "";
				var editDistance = 0;
				var mismatches = "", oldMismatches = null;
				var exonerateSequence = "", exonerateReference = "";
				
				for (var i = 0; i < alignment.length; i++) {
					if (alignment[i].indexOf("Raw score: ") !== -1) {
						rawScore = alignment[i].split(": ")[1];
					}
					if (alignment[i].indexOf("cigar:") !== -1) {
						cigar = alignment[i].split(rawScore)[1].replace(/ /g, "");
						cigar = reverseCIGAR(cigar);
						break;
					}
					if (alignment[i].substr(0, 5) === "  1 :") {
						if (exonerateSequence === "") {
							exonerateSequence += alignment[i].substr(6, alignment[i].lastIndexOf(":") - 7);
							exonerateSequence += alignment[i + 4].substr(6, alignment[i + 4].lastIndexOf(":") - 7);
						} else {
							exonerateReference += alignment[i].substr(6, alignment[i].lastIndexOf(":") - 7);
							exonerateReference += alignment[i + 4].substr(6, alignment[i + 4].lastIndexOf(":") - 7);
						}
						mismatches += alignment[i + 1].substr(6, alignment[i + 1].length - 6);
						mismatches += alignment[i + 5].substr(6, alignment[i + 5].length - 6);
					}
					
				}
				
//				if (cigar === "") {
					sys.puts("oldPosition: " + oldPosition);
					sys.puts("referencePosition: " + referencePosition);
//				}
				
				var editDistance = calculateEditDistance(sequence, reference.sequence);
				
				altConcat.push(chromosomeName + "," + (referencePosition + 1) + "," + cigar + "," + editDistance);
				
				if (altConcat.length >= alternativeHits.length - 1) {
					//Returns format: (chr,pos,CIGAR,NM;)
					callback(null, altConcat.join(";"));
				}
				
			});
		
		});
		
	}
	
}
*/

function calculateMismatches(mismatches, sequence, reference) {

	var matches = 0;
	var newMismatches = [];
	for (var i = 0; i < mismatches.length; i++) {
		if (mismatches.substr(i, 1) === " ") {
			newMismatches.push(matches);
			var differentSequenceBase = sequence.substr(i, 1);
			var differentReferenceBase = reference.substr(i, 1);

			if (differentSequenceBase !== "-" && differentReferenceBase !== "-") {
				newMismatches.push(differentSequenceBase);
			}
			else if (differentSequenceBase === "-") {
				//Check if preceding base was also a deletion
				if (sequence.substr(i - 1, 1) === "-") {
					//Pop the 0-matched 
					newMismatches.pop();
					newMismatches.push(reference.substr(i, 1));
				} else {
					if (newMismatches[newMismatches.length - 1] === 0) {
						newMismatches.pop();
					}
					newMismatches.push("^" + reference.substr(i, 1));
				}
			} else if (differentReferenceBase === "-") {
				if (newMismatches[newMismatches.length - 1] === 0) {
					newMismatches.pop();
				}
			}

			matches = 0;
		} else {
			matches++;
		}
	}
	if (matches > 0) {
		newMismatches.push(matches);
	}
	if (newMismatches.length === 0) {
		newMismatches.push(0);
	}

	return newMismatches.join("");

}

function trim(string) {
    return string.replace(/^\s*|\s*$/, '')
}

function reverseCIGAR(cigar) {
	
	var charPosition = 0,
		newCigar = [];
	
	for (var i = 1; i < cigar.length; i++) {
		if (!isNumeric(cigar.substr(i, 1))) {
			newCigar.push(cigar.substr(charPosition, 1));
			charPosition = i;
		} else {
			newCigar.push(cigar.substr(i, 1));
		}
	}
	newCigar.push(cigar.substr(charPosition, 1));
	
	return newCigar.join("");

}

function isNumeric(input)
{
   return (input - 0) == input && input.length > 0;
}

function calculateEditDistance(sequence, reference) {
	var cost;
	
	var a = sequence;
	var m = a.length;
	
	var b = reference;
	var n = b.length;
	
	if (m < n) {
		var c=a;a=b;b=c;
		var o=m;m=n;n=o;
	}
	
	var r = new Array();
	r[0] = new Array();
	for (var c = 0; c < n+1; c++) {
		r[0][c] = c;
	}
	
	for (var i = 1; i < m+1; i++) {
		r[i] = new Array();
		r[i][0] = i;
		for (var j = 1; j < n+1; j++) {
			cost = (a.charAt(i-1) == b.charAt(j-1))? 0: 1;
			r[i][j] = getSmallestValue(r[i-1][j]+1,r[i][j-1]+1,r[i-1][j-1]+cost);
		}
	}
	
	return r[m][n];
}

getSmallestValue = function(x,y,z) {
	if (x < y && x < z) return x;
	if (y < x && y < z) return y;
	return z;
}

function createReferenceFile(sequence, chromosomeName, referencePosition, changes) {

	var insertionsLength = 0;
	var deletionsLength = 0;

	//Take into account the indels that are applied to this region	
	for (var i = 0; i < changes.length; i++) {
		if (changes[i][3].substr(0, 1) === "I") {
			insertionsLength += changes[i][3].split("-")[1].length;
		}
		if (changes[i][3].substr(0, 1) === "D") { 
			deletionsLength += (parseFloat(changes[i][2]) - parseFloat(changes[i][1]));
		}
	}

	var readLength = sequence.length - insertionsLength + deletionsLength;
	//Reference position should be 0-based
	var headerLength = (">" + chromosomeName).length + 1;
	var start = referencePosition + getNrOfLineBreaks(referencePosition) + headerLength;
	var end = referencePosition + readLength + getNrOfLineBreaks(referencePosition + readLength) + headerLength;

	var chromosomeFile = fs.openSync("./chromosomes/" + chromosomeName + ".fa", "r");
	var referenceSequence = fs.readSync(chromosomeFile, end - start, start, "ascii")[0].replace(/\n/g, "").toUpperCase();
	fs.closeSync(chromosomeFile);
	
	var referenceFileName = "./tmp/ref_" + referenceSequence + "_" + new Date().getTime() + ".fa";
	var referenceFile = fs.openSync(referenceFileName, "w");
	fs.writeSync(referenceFile, ">Reference\n" + referenceSequence, 0, "ascii");
	fs.closeSync(referenceFile);

	return {"fileName": referenceFileName, "sequence": referenceSequence};
}

function reverseComplement(sequence) {
	sequence = complement(sequence);
	sequence = sequence.split("").reverse().join("");
	return sequence;
}

function getNrOfLineBreaks(number, charsPerLine) {
	charsPerLine = (charsPerLine === undefined) ? 50: charsPerLine;
	var result = Math.floor(number/charsPerLine);

	((number % charsPerLine) === 0) ? --result : '';

	return result;
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

function complement(dnaSequence)	{
	//there is no tr operator
	//should write a tr method to replace this
	dnaSequence = dnaSequence.replace(/g/g,"1");
	dnaSequence = dnaSequence.replace(/c/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"c");
	dnaSequence = dnaSequence.replace(/2/g,"g");
	dnaSequence = dnaSequence.replace(/G/g,"1");
	dnaSequence = dnaSequence.replace(/C/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"C");
	dnaSequence = dnaSequence.replace(/2/g,"G");	

	dnaSequence = dnaSequence.replace(/a/g,"1");
	dnaSequence = dnaSequence.replace(/t/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"t");
	dnaSequence = dnaSequence.replace(/2/g,"a");
	dnaSequence = dnaSequence.replace(/A/g,"1");
	dnaSequence = dnaSequence.replace(/T/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"T");
	dnaSequence = dnaSequence.replace(/2/g,"A");

	dnaSequence = dnaSequence.replace(/u/g,"a");
	dnaSequence = dnaSequence.replace(/U/g,"A");

	dnaSequence = dnaSequence.replace(/r/g,"1");
	dnaSequence = dnaSequence.replace(/y/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"y");
	dnaSequence = dnaSequence.replace(/2/g,"r");
	dnaSequence = dnaSequence.replace(/R/g,"1");
	dnaSequence = dnaSequence.replace(/Y/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"Y");
	dnaSequence = dnaSequence.replace(/2/g,"R");	

	dnaSequence = dnaSequence.replace(/k/g,"1");
	dnaSequence = dnaSequence.replace(/m/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"m");
	dnaSequence = dnaSequence.replace(/2/g,"k");
	dnaSequence = dnaSequence.replace(/K/g,"1");
	dnaSequence = dnaSequence.replace(/M/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"M");
	dnaSequence = dnaSequence.replace(/2/g,"K");

	dnaSequence = dnaSequence.replace(/b/g,"1");
	dnaSequence = dnaSequence.replace(/v/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"v");
	dnaSequence = dnaSequence.replace(/2/g,"b");
	dnaSequence = dnaSequence.replace(/B/g,"1");
	dnaSequence = dnaSequence.replace(/V/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"V");
	dnaSequence = dnaSequence.replace(/2/g,"B");

	dnaSequence = dnaSequence.replace(/d/g,"1");
	dnaSequence = dnaSequence.replace(/h/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"h");
	dnaSequence = dnaSequence.replace(/2/g,"d");
	dnaSequence = dnaSequence.replace(/D/g,"1");
	dnaSequence = dnaSequence.replace(/H/g,"2");
	dnaSequence = dnaSequence.replace(/1/g,"H");
	dnaSequence = dnaSequence.replace(/2/g,"D");
		
	return dnaSequence;
}