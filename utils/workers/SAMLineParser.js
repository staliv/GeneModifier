var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("../FileLineReader");
var scoreCalculator = require("../CalculateAlignmentScore");
var positionBackMapper = require("../../PositionBackMapper");
var exec = require("child_process").exec;
var settings = require("../../settings").settings;

var exonerate = settings.exonerate;

var worker = require("../../node_modules/worker").worker;
 
worker.onmessage = function (msg) {

    var lines = msg.lines;
    var keys = msg.keys;
	var count = 0;
	var newLines = [];

	for (var i=0; i < lines.length; i++) {
				
		count++;

		//Parse each line
		parseLine(lines[i].split("\t"), keys, function(modifiedLine) {
			if (modifiedLine !== "") {
				newLines.push(modifiedLine);
			}
			--count;
			if (count === 0) {
				worker.postMessage({
					out: newLines
				});
			}
		});
	}
};

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
			var sequenceFileName = "./tmp/seq_" + line[9] + "_" + getRandomString() + ".fa";
			var sequenceFile = fs.openSync(sequenceFileName, "w");

			fs.writeSync(sequenceFile, ">Sequence\n" + line[9], 0, "ascii");
			fs.closeSync(sequenceFile);
			var editDistance = 0;

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
				editDistance = calculateEditDistance(line[9], reference.sequence);
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

				
//				modifiedLine.push("YM:i:" + scoreCalculator.getAlignmentScore(oldCigar, oldMismatches));
				modifiedLine.push("ZM:Z:" + key.changeset);

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
//			modifiedLine.push("YM:i:" + scoreCalculator.getAlignmentScore(line[5], oldMismatches));
			modifiedLine.push("ZM:Z:" + key.changeset);

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

function getRandomString() {
	return process.pid + "-" + (Math.random() * 0x100000000 + 1).toString(36);
}

function calculateMismatches(mismatches, sequence, reference) {

	var matches = 0;
	var newMismatches = [];
	var pushZero = false;
	
	for (var i = 0; i < mismatches.length; i++) {
		if (mismatches.substr(i, 1) === " ") {
			newMismatches.push(matches);
			var differentSequenceBase = sequence.substr(i, 1);
			var differentReferenceBase = reference.substr(i, 1);

			if (differentSequenceBase !== "-" && differentReferenceBase !== "-") {
				newMismatches.push(differentReferenceBase);
				pushZero = true;
			}
			else if (differentSequenceBase === "-") {
				pushZero = false;
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
					pushZero = true;
				}
			} else if (differentReferenceBase === "-") {
				pushZero = false;
				if (newMismatches[newMismatches.length - 1] === 0) {
					newMismatches.pop();
				}
			}

			matches = 0;
		} else {
			matches++;
		}
	}
	if (matches > 0 || (matches === 0 && pushZero)) {
		newMismatches.push(matches);
	}
	if (newMismatches.length === 0) {
		newMismatches.push(0);
	}

	return newMismatches.join("");

}

function trim(string) {
    return string.replace(/^\s*|\s*$/, '');
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
	
	var r = [];
	r[0] = [];
	for (var c = 0; c < n+1; c++) {
		r[0][c] = c;
	}
	
	for (var i = 1; i < m+1; i++) {
		r[i] = [];
		r[i][0] = i;
		for (var j = 1; j < n+1; j++) {
			cost = (a.charAt(i-1) == b.charAt(j-1))? 0: 1;
			r[i][j] = getSmallestValue(r[i-1][j]+1,r[i][j-1]+1,r[i-1][j-1]+cost);
		}
	}
	
	return r[m][n];
}

function getSmallestValue(x,y,z) {
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
	
	var referenceFileName = "./tmp/ref_" + referenceSequence + "_" + getRandomString() + ".fa";
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
		
		if (sets[0] === key.chromosome && 
				(
					(parseFloat(sets[1]) >= position && parseFloat(sets[1]) <= (position + sequenceLength)) || 
					(parseFloat(sets[2]) >= position && parseFloat(sets[2]) <= (position + sequenceLength))
				)
			) {
			changes.push([sets[0], sets[1], sets[2], sets[3]]);
		}
	}
	return changes;
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
