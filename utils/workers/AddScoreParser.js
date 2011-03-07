var scoreCalculator = require("../CalculateAlignmentScore");
var worker = require("../../node_modules/worker").worker;
 
worker.onmessage = function (msg) {

    var lines = msg.lines;
	var count = lines.length;
	var newLines = [];

//	sys.error("Got " + lines.length);

	for (var i=0; i < lines.length; i++) {
				
//		count++;

		//Parse each line
		parseLine(lines[i].split("\t"), function(modifiedLine) {
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

function parseLine(splitLine, callback) {

	var cigar = splitLine[5];
	var mismatches = null;

	//Find MD:Z (mismatches)
	for (var i = 11; i < splitLine.length; i++) {
		if (splitLine[i].split(":")[0] === "MD") {
			mismatches = splitLine[i].split(":");
			mismatches = mismatches[mismatches.length - 1];
			i = splitLine.length;
		}
	}
	callback(splitLine.join("\t") + "\tYM:i:" + scoreCalculator.getAlignmentScore(cigar, mismatches));

}