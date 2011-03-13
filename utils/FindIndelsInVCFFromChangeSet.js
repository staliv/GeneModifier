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
		findIndels(process.argv[process.argv.length - 2], process.argv[process.argv.length - 1], function(error, matches) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			sys.puts(matches.join("\n"));
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
				var vcfReader = fileLineReader.FileLineReader(vcf, 1024 * 128),
					line = null,
					splitLine = [],
					matches = [],
					lineCounter = 0,
					changeSetName = path.basename(changeSet, ".cs"),
					changes = fs.readFileSync(changeSet, "utf8").split("\n"),
					positionEasing = 200,
					lengthEasing = 3,
					badMatchEasing = 10,
					nrOfPossibleMatches = 0,
					nrOfBadMatches = 0,
					changesFound = [];
				
//				matches.push("##fileformat=VCFv4.0");
//				matches.push("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT");
				
				while (true) {
					line = vcfReader.nextLine();
					splitLine = line.split("\t");
					lineCounter++;
				
					if (line.substr(0, 1) !== "#") {

						//Insertion or deletion?
						if (splitLine[3].length > 1) {
							//deletion
							
							var refAlleles = parseFloat(splitLine[splitLine.length - 1].split(":")[1].split(",")[0]);
							var altAlleles = parseFloat(splitLine[splitLine.length - 1].split(":")[1].split(",")[1]);
							var chromosome = splitLine[0];
							var position = parseFloat(splitLine[1]);
							var length = splitLine[3].length - 1;
							
							for (var i = 0; i < changes.length; i++) {
								var change = changes[i].split("\t");
								if (change[0] === chromosome &&
									change[3].substr(0, 1) === "D" && 
									parseFloat(change[1]) - positionEasing < position &&
									parseFloat(change[2]) + positionEasing > position &&
									parseFloat(change[2]) - parseFloat(change[1]) <= length + lengthEasing &&
									parseFloat(change[2]) - parseFloat(change[1]) >= length - lengthEasing
								) {
									var modifiedPercentage = (altAlleles / (refAlleles + altAlleles)) * 100;
									var originalPercentage = parseFloat(change[change.length - 1].replace(",", "."));
									var modifiedDiffTo50 = (modifiedPercentage >= 50) ? modifiedPercentage - 50 : 50 - modifiedPercentage;
									var originalDiffTo50 = (originalPercentage >= 50) ? originalPercentage - 50 : 50 - originalPercentage;
									if (modifiedDiffTo50 < originalDiffTo50) {
										matches.push("Possible:");
										matches.push("D " + splitLine[0] + "\t" + splitLine[1] + "\t" + splitLine[3].substr(1) + "\t" + modifiedPercentage.toFixed(1) + "\t" + modifiedDiffTo50.toFixed(1) +  "\t" + altAlleles + "/" + (refAlleles + altAlleles));
										matches.push("D " + change[0] + "\t" + change[1] + "\t" + change[4] + "\t" + originalPercentage + "\t" + originalDiffTo50.toFixed(1));
										matches.push("");
										nrOfPossibleMatches++;
										changesFound.push(changes[i]);
									} else if (modifiedDiffTo50 < (originalDiffTo50 + badMatchEasing)) {
										matches.push("Bad match:");
										matches.push("D " + splitLine[0] + "\t" + splitLine[1] + "\t" + splitLine[3].substr(1) + "\t" + modifiedPercentage.toFixed(1) + "\t" + modifiedDiffTo50.toFixed(1) +  "\t" + altAlleles + "/" + (refAlleles + altAlleles));
										matches.push("D " + change[0] + "\t" + change[1] + "\t" + change[4] + "\t" + originalPercentage + "\t" + originalDiffTo50.toFixed(1));
										matches.push("");
										nrOfBadMatches++;
									}
								}
							}
							
						} else if (splitLine[4].length > 1) {
							//insertion

							var refAlleles = parseFloat(splitLine[splitLine.length - 1].split(":")[1].split(",")[0]);
							var altAlleles = parseFloat(splitLine[splitLine.length - 1].split(":")[1].split(",")[1]);
							var chromosome = splitLine[0];
							var position = parseFloat(splitLine[1]);
							var length = splitLine[4].length - 1;
							
							for (var i = 0; i < changes.length; i++) {
								var change = changes[i].split("\t");
								if (change[0] === chromosome &&
									change[3].substr(0, 1) === "I" && 
									parseFloat(change[1]) - positionEasing < position &&
									parseFloat(change[2]) + positionEasing > position &&
									change[3].substr(2).length <= length + lengthEasing &&
									change[3].substr(2).length >= length - lengthEasing
								) {
									var modifiedPercentage = (altAlleles / (refAlleles + altAlleles)) * 100;
									var originalPercentage = parseFloat(change[change.length - 1].replace(",", "."));
									var modifiedDiffTo50 = (modifiedPercentage >= 50) ? modifiedPercentage - 50 : 50 - modifiedPercentage;
									var originalDiffTo50 = (originalPercentage >= 50) ? originalPercentage - 50 : 50 - originalPercentage;
									if (modifiedDiffTo50 < originalDiffTo50) {
										matches.push("Possible:");
										matches.push("I " + splitLine[0] + "\t" + splitLine[1] + "\t" + splitLine[4].substr(1) + "\t" + modifiedPercentage.toFixed(1) + "\t" + modifiedDiffTo50.toFixed(1) + "\t" + altAlleles + "/" + (refAlleles + altAlleles));
										matches.push("I " + change[0] + "\t" + change[1] + "\t" + change[3].substr(2) + "\t" + originalPercentage + "\t" + originalDiffTo50.toFixed(1));
										matches.push("");
										nrOfPossibleMatches++;
										changesFound.push(changes[i]);
									} else if (modifiedDiffTo50 < (originalDiffTo50 + badMatchEasing)) {
										matches.push("Bad match:");
										matches.push("I " + splitLine[0] + "\t" + splitLine[1] + "\t" + splitLine[4].substr(1) + "\t" + modifiedPercentage.toFixed(1) + "\t" + modifiedDiffTo50.toFixed(1) + "\t" + altAlleles + "/" + (refAlleles + altAlleles));
										matches.push("I " + change[0] + "\t" + change[1] + "\t" + change[3].substr(2) + "\t" + originalPercentage + "\t" + originalDiffTo50.toFixed(1));
										matches.push("");
										nrOfBadMatches++;
									}
								}
							}

							
						}
						//Check if ID has current changeSetName in it
						//Check if position is inside interval for a change
/*						

						if (splitLine[3].substr(0, 1) === "I") {
							referenceBase = getReferenceBase(splitLine[0], parseFloat(splitLine[1]) - 1);
							vcf.push(splitLine[0] + "\t" + splitLine[1] + "\t" + changeSetName + "_" + lineCounter + "\t" + referenceBase + "\t" + referenceBase + splitLine[5] + "\t.\t.\t.\t.");
						}

						if (splitLine[3].substr(0, 1) === "D") {
							referenceBase = getReferenceBase(splitLine[0], parseFloat(splitLine[1]) - 1);
							vcf.push(splitLine[0] + "\t" + splitLine[1] + "\t" + changeSetName + "_" + lineCounter + "\t" + referenceBase + splitLine[4] + "\t" + referenceBase + "\t.\t.\t.\t.");
						}
*/				
						if (!vcfReader.hasNextLine()) {
							break;
						}
					}
				}

				var nrOfIndelsInChangeSet = 0,
					changesNotFound = [];
				
				for (var i = 0; i < changes.length; i++) {
					if (changes[i] !== "" && changes[i].substr(0, 1) !== "#" && (changes[i].split("\t")[3].substr(0, 1) === "D" || changes[i].split("\t")[3].substr(0, 1) === "I")) {
//						sys.error(changes[i]);
						nrOfIndelsInChangeSet++;

						var notFound = true;
						for (var y = 0; y < changesFound.length; y++) {
							if (changes[i] === changesFound[y]) {
								notFound = false;
								break;
							}
						}
						if (notFound) {
							changesNotFound.push(changes[i]);
						}
					}
				}

				sys.error("Found " + nrOfPossibleMatches + " of " + nrOfIndelsInChangeSet + " plus " + nrOfBadMatches + " bad matches.")
				if (changesNotFound.length > 0) {
					sys.error("Did not find: ");
					for (var i=0; i < changesNotFound.length; i++) {
						sys.error(changesNotFound[i]);
					}
				}

				callback(null, matches);
			} else {
				return callback(new Error("The vcf '" + file + "' does not exist."));		
			}
		});
		} else {
			return callback(new Error("The changeset '" + file + "' does not exist."));		
		}
	});
}
