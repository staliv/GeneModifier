var scoreCalculator = require("../CalculateAlignmentScore");
var worker = require("../../node_modules/worker").worker;
 
worker.onmessage = function (msg) {

    var lines = msg.lines;
	var count = lines.length;
	var newLines = [];
	var line = null;
	var previousLines = [];
	
	for (var i = 0; i < count; i++) {

		line = lines[i];

		var readId = line.substr(0, line.indexOf("\t"));
		var score = parseFloat(line.substr(line.indexOf("YM:i:") + 5, 2));
		if (previousLines.length === 0) {
			//Push a new compare object
			previousLines.push({"id": readId, "score": score, "line": line});
		} else if (previousLines[0].id === readId) {
			//Add one more compare object
			previousLines.push({"id": readId, "score": score, "line": line});
		} else if (previousLines[0].id !== readId) {
			//Compare previous objects
			newLines.push(getBestLine(previousLines));
			//Empty the array
			previousLines = [];
			//Push current line as new compare object
			previousLines.push({"id": readId, "score": score, "line": line});
		}
	}

	if (previousLines.length > 0) {
		//Last line should be compared
		newLines.push(getBestLine(previousLines));
	}

	worker.postMessage({
		out: newLines
	});
};

function getBestLine(previousLines) {
	if (previousLines.length >= 2) {
		//Sort based on score
		previousLines.sort(sortLines);
		//Keep the best one, i.e. the first one
		var keep = previousLines[0];
		
		//Check for alternative hits in the other matches with same score
		for (var x = 1; x < previousLines.length; x++) {
			if (previousLines[x].score === keep.score && previousLines[x].line.indexOf("XA:Z:") > -1) {
				keep = addAltHits(keep, previousLines[x]);
			}
		}
		//Output best match
		return keep.line;
	} else {
		//Only one match
		return previousLines[0].line;
	}
}

function addAltHits(keep, other) {

	//Extract alternative hits
	var altPosition = other.line.indexOf("XA:Z:");
	var altHits = other.line.substr(altPosition + 5).split("\t")[0];
	
	var keepLine = keep.line.split("\t");
	
	if (keep.line.indexOf("XA:Z:")) {
		for (var i = 11; i < keepLine.length; i++) {
			if (keepLine[i].length >= 5 && keepLine[i].substr(0, 5) === "XA:Z:") {
				keepLine[i] += altHits;
				break;
			}
		}
	} else {
		keepLine.push("XA:Z:" + altHits);
	}
	keep.line = keepLine.join("\t");
	altHits = null;
	altPosition = null;
	keepLine = null;
	return keep;
}

var sortLines = function(a, b) {
	var lineAScore = a.score, lineBScore = b.score;
	
	if (lineAScore > lineBScore) {
		return -1;
	}
	if (lineAScore < lineBScore) {
		return 1;
	}
	return 0;
};
