#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("./FileLineReader");

var log4js = require("../node_modules/log4js")();
log4js.configure("logs/config.json");

//Accepts the vcf and changeset path from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 32, process.argv[1].length) == "/FindIndelsInVCFFromChangeSet.js") {
	if (process.argv.length <= 3) {
		sys.puts("Example usage: 'node FindIndelsInVCFFromChangeSet.js pathToVCF pathToChangeSet'");
	}
	else {
		findIndels(process.argv[process.argv.length - 2], process.argv[process.argv.length - 1], function(error, result) {
			if (error) {
				sys.puts(error.message);
				return;
			}
//			console.dir(result);
			sys.puts("Found " + result.stats.Found + " of " + result.stats.Possible + " plus " + result.stats.Bad + " bad.");
			sys.puts("");
			
			if (result.notfound.length > 0) {
				sys.error("Did not find: ");
				for (var i=0; i < result.notfound.length; i++) {
					sys.error(result.notfound[i]);
				}
				sys.puts("");
			}			

			sys.puts("Insertions: ");
			result.matches.insertions.forEach(function(element, i) {
				sys.puts("Modified:  " + element.modified);
				sys.puts("Reference: " + element.reference);
				sys.puts("Original:  " + element.original);
				sys.puts("");
			});
			sys.puts("Deletions: ");
			result.matches.deletions.forEach(function(element, i) {
				sys.puts("\tModified:  " + element.modified);
				sys.puts("\tReference: " + element.reference);
				sys.puts("\tOriginal:  " + element.original);
				sys.puts("");
				
			});
		});
	}
}

exports.findIndels = findIndels;



//Returns callback(error, matches)
function findIndels(vcf, changeSet) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	path.exists(changeSet, function(exists) {
		if (exists) {
			path.exists(vcf, function(exists) {
				if (exists) {
				var vcfReader = fs.readFileSync(vcf, "utf8").split("\n"), //fileLineReader.FileLineReader(vcf, 1024 * 128),
					splitLine = [],
					changeSetName = path.basename(changeSet, ".cs"),
					changes = fs.readFileSync(changeSet, "utf8").split("\n"),
					positionEasing = 75,
					lengthEasing = 0,
					badMatchEasing = 49.9,
					nrOfPossibleMatches = 0,
					nrOfBadMatches = 0,
					changesFound = [];
				
				var matches = {"insertions": [], "deletions": []};
				
				var referenceRefAlleles = null,
					referenceAltAlleles = null,
					modifiedRefAlleles = null,
					modifiedAltAlleles = null,
					chromosome = null,
					position = null,
					length = null,
					match = null;
					
				var modifiedPercentage = null,
					referencePercentage = null,
					originalPercentage = null,
					modifiedDiffTo50 = null,
					referenceDiffTo50 = null,
					originalDiffTo50 = null,
					change = null;
								
				vcfReader.forEach(function(line, lineCounter) {
				
					if (line !== "" && line.substr(0, 1) !== "#") {

						splitLine = line.split("\t");

						//Insertion or deletion?
						if (splitLine[3].length > 1) {
							//deletion
							
							referenceRefAlleles = parseFloat(splitLine[splitLine.length - 1].split(":")[1].split(",")[0]);
							referenceAltAlleles = parseFloat(splitLine[splitLine.length - 1].split(":")[1].split(",")[1]);
							modifiedRefAlleles = parseFloat(splitLine[splitLine.length - 2].split(":")[1].split(",")[0]);
							modifiedAltAlleles = parseFloat(splitLine[splitLine.length - 2].split(":")[1].split(",")[1]);
							chromosome = splitLine[0];
							position = parseFloat(splitLine[1]);
							length = splitLine[3].length - 1;
							
							//for (var y = 0; y < changes.length; y++) {
							changes.forEach(function(change, y) {
								var deletion = {};
								if (change !== "") {
									change = change.split("\t");
									if (change[0] === chromosome &&
										change[3].substr(0, 1) === "D" && 
										parseFloat(change[1]) - positionEasing < position &&
										parseFloat(change[2]) + positionEasing > position &&
										(parseFloat(change[2]) - parseFloat(change[1])) <= length + lengthEasing &&
										(parseFloat(change[2]) - parseFloat(change[1])) >= length - lengthEasing
									) {
										modifiedPercentage = parseFloat(modifiedAltAlleles / (modifiedRefAlleles + modifiedAltAlleles)) * 100;
										referencePercentage = parseFloat(referenceAltAlleles / (referenceRefAlleles + referenceAltAlleles)) * 100;
										originalPercentage = parseFloat(change[6].replace(",", "."));
										modifiedDiffTo50 = (modifiedPercentage >= parseFloat(50)) ? modifiedPercentage - 50 : 50 - modifiedPercentage;
										referenceDiffTo50 = (referencePercentage >= parseFloat(50)) ? referencePercentage - 50 : 50 - referencePercentage;
										originalDiffTo50 = (originalPercentage >= parseFloat(50)) ? originalPercentage - 50 : 50 - originalPercentage;
										
										if (modifiedDiffTo50 <= badMatchEasing) {
											deletion.modified = splitLine[0] + "," + splitLine[1] + "," + splitLine[3].substr(1) + "," + modifiedPercentage.toFixed(1) + "," + modifiedDiffTo50.toFixed(1) +  "," + modifiedAltAlleles + "/" + (modifiedRefAlleles + modifiedAltAlleles);
											deletion.reference = splitLine[0] + "," + splitLine[1] + "," + splitLine[3].substr(1) + "," + referencePercentage.toFixed(1) + "," + referenceDiffTo50.toFixed(1) +  "," + referenceAltAlleles + "/" + (referenceRefAlleles + referenceAltAlleles);
											deletion.original = change[0] + "," + change[1] + "," + change[4] + "," + originalPercentage + "," + originalDiffTo50.toFixed(1) + "," + change[7] + "/" + Math.round(parseFloat(change[7]) / (originalPercentage/100));
											matches.deletions.push(deletion);
											nrOfPossibleMatches++;
											changesFound.push(change.join("\t"));
										}
									}
								}
							});
							
						} else if (splitLine[4].length > 1) {
							//insertion

							referenceRefAlleles = parseFloat(splitLine[splitLine.length - 1].split(":")[1].split(",")[0]);
							referenceAltAlleles = parseFloat(splitLine[splitLine.length - 1].split(":")[1].split(",")[1]);
							modifiedRefAlleles = parseFloat(splitLine[splitLine.length - 2].split(":")[1].split(",")[0]);
							modifiedAltAlleles = parseFloat(splitLine[splitLine.length - 2].split(":")[1].split(",")[1]);
							chromosome = splitLine[0];
							position = parseFloat(splitLine[1]);
							length = splitLine[4].length - 1;
							//for (var b = 0; b < changes.length; b++) {
							changes.forEach(function(change, b) {
								var insertion = {};
								if (change !== "") {
									change = change.split("\t");
									if (change[0] === chromosome &&
										change[3].substr(0, 1) === "I" && 
										parseFloat(change[1]) - positionEasing < position &&
										parseFloat(change[2]) + positionEasing > position &&
										change[3].substr(2).length <= length + lengthEasing &&
										change[3].substr(2).length >= length - lengthEasing
									) {
										modifiedPercentage = parseFloat(modifiedAltAlleles / (modifiedRefAlleles + modifiedAltAlleles)) * 100;
										referencePercentage = parseFloat(referenceAltAlleles / (referenceRefAlleles + referenceAltAlleles)) * 100;
										originalPercentage = parseFloat(change[6].replace(",", "."));
										modifiedDiffTo50 = (modifiedPercentage >= parseFloat(50)) ? modifiedPercentage - 50 : 50 - modifiedPercentage;
										referenceDiffTo50 = (referencePercentage >= parseFloat(50)) ? referencePercentage - 50 : 50 - referencePercentage;
										originalDiffTo50 = (originalPercentage >= parseFloat(50)) ? originalPercentage - 50 : 50 - originalPercentage;

										if (modifiedDiffTo50 <= badMatchEasing) {
											//matches.push("Possible:");
											insertion.modified = splitLine[0] + "," + splitLine[1] + "," + splitLine[4].substr(1) + "," + modifiedPercentage.toFixed(1) + "," + modifiedDiffTo50.toFixed(1) + "," + modifiedAltAlleles + "/" + (modifiedRefAlleles + modifiedAltAlleles);
											insertion.reference = splitLine[0] + "," + splitLine[1] + "," + splitLine[4].substr(1) + "," + referencePercentage.toFixed(1) + "," + referenceDiffTo50.toFixed(1) + "," + referenceAltAlleles + "/" + (referenceRefAlleles + referenceAltAlleles);
											insertion.original = change[0] + "," + change[1] + "," + change[3].substr(2) + "," + originalPercentage + "," + originalDiffTo50.toFixed(1) + "," + change[7] + "/" + Math.round(parseFloat(change[7]) / (originalPercentage/100));
											//matches.push("");
											matches.insertions.push(insertion);
											nrOfPossibleMatches++;
											changesFound.push(change.join("\t"));
										}
									}
								}
							});							
						}
					}
				});

				var nrOfIndelsInChangeSet = 0,
					changesNotFound = [];
				
				for (var x = 0; x < changes.length; x++) {
					if (changes[x] !== "" && changes[x].substr(0, 1) !== "#" && (changes[x].split("\t")[3].substr(0, 1) === "D" || changes[x].split("\t")[3].substr(0, 1) === "I")) {
//						sys.error(changes[i]);
						nrOfIndelsInChangeSet++;

						var notFound = true;
						for (var z = 0; z < changesFound.length; z++) {
							if (changes[x] === changesFound[z]) {
								notFound = false;
								break;
							}
						}
						if (notFound) {
//							changes[x]
							changesNotFound.push(changes[x]);
						}
					}
				}

				var stats = {"Found": nrOfPossibleMatches, "Possible": nrOfIndelsInChangeSet, "Bad": nrOfBadMatches};
/*				sys.error("Found " + nrOfPossibleMatches + " of " + nrOfIndelsInChangeSet + " plus " + nrOfBadMatches + " bad matches.")
				if (changesNotFound.length > 0) {
					sys.error("Did not find: ");
					for (var i=0; i < changesNotFound.length; i++) {
						sys.error(changesNotFound[i]);
					}
				}
*/
				callback(null, {"matches": matches, "notfound": changesNotFound, "stats": stats});
			} else {
				return callback(new Error("The vcf '" + file + "' does not exist."));		
			}
		});
		} else {
			return callback(new Error("The changeset '" + file + "' does not exist."));		
		}
	});
}
