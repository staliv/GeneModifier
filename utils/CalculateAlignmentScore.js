exports.getAlignmentScore = function (cigar, mismatches) {

	var matchScore = 1;
	var firstDeletionPenalty = -5;
	var deletionPenalty = -2;
	var firstInsertionPenalty = -5;
	var insertionPenalty = -2;
	var mismatchPenalty = -2;
	var score = 0;
	
	//Find matches from cigar = base score to subtract from
	var match = cigar.split("M");
	for (var i = 0; i < match.length; i++) {
		var foundScore = null;
		for (var x = match[i].length - 1; x >= 0; x--) {
			if (!isNumeric(match[i].substr(x, 1))) {
				foundScore = match[i].substr(x + 1, match[i].length - x - 1);
				x = -1;
			}
			
			if (x <= 0 && !foundScore && isNumeric(match[i])) {
				foundScore = match[i];
			}
		}
		if (foundScore) {
			score += parseFloat(foundScore) * matchScore;
		}
		
	}

	//Find deletions
	match = cigar.split("D");
	for (var i = 0; i < match.length; i++) {
		var foundScore = null;
		for (var x = match[i].length - 1; x >= 0; x--) {
			if (!isNumeric(match[i].substr(x, 1))) {
				foundScore = match[i].substr(x + 1, match[i].length - x - 1);
				x = -1;
			}
			
			if (x <= 0 && !foundScore && isNumeric(match[i])) {
				foundScore = match[i];
			}
		}
		if (foundScore) {
			score += ((1 * firstDeletionPenalty) + (parseFloat(foundScore) - 1) * deletionPenalty);
		}
	}
	
	//Find insertions
	match = cigar.split("I");
	for (var i = 0; i < match.length; i++) {
		var foundScore = null;
		for (var x = match[i].length - 1; x >= 0; x--) {
			if (!isNumeric(match[i].substr(x, 1))) {
				foundScore = match[i].substr(x + 1, match[i].length - x - 1);
				x = -1;
			}
			
			if (x <= 0 && !foundScore && isNumeric(match[i])) {
				foundScore = match[i];
			}
		}
		if (foundScore) {
			score += ((1 * firstInsertionPenalty) + (parseFloat(foundScore) - 1) * insertionPenalty);
		}
	}

	//Find substituted base pairs and subtract for each substitution
	if (mismatches && mismatches !== "") {

		var isDeletion = false;
		var currentBase = "";
		var nrOfMismatches = 0;

		for (var i = 0; i < mismatches.length; i++) {
		
			currentBase = mismatches.substr(i, 1);
		
			if (isNumeric(currentBase)) {
				isDeletion = false;
			}
		
			switch (currentBase) {
				case "^":
					isDeletion = true;
					break;
				case "A":
					if (!isDeletion) {
						nrOfMismatches++;
					}
					break;
				case "C": 
					if (!isDeletion) {
						nrOfMismatches++;
					}
					break;
				case "T": 
					if (!isDeletion) {
						nrOfMismatches++;
					}
					break;
				case "G": 
					if (!isDeletion) {
						nrOfMismatches++;
					}
					break;
				default: 
					break;
			}
		}
		score += nrOfMismatches * mismatchPenalty;
	}
	
	return score;
}

function isNumeric(input) {
   return (input - 0) == input && input.length > 0;
}

