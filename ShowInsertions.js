#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("./utils/FileLineReader");
var settings = require("./settings").settings;
var indelsFinder = require("./utils/FindIndelsInVCFFromChangeset");

var log4js = require("./node_modules/log4js")();
log4js.configure("logs/config.json");

//Accepts the vcf and changeset path from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 18, process.argv[1].length) == "/ShowInsertions.js") {
	if (process.argv.length <= 1) {
		sys.puts("Example usage: 'node ShowInsertions'");
	}
	else {
		showInsertions(function(error, result) {
			if (error) {
				console.dir(error);
			}
			var referenceResults = [];
			var modifiedResults = [];

			var compareSets = [];
			
			sys.puts("Mod\tRef\tLength\tDiff\tModified\t\t\t\t\tReference\t\t\t\t\tOriginal");
			result.forEach(function(element, i) {
				element.modified.forEach(function(modifiedIndel, y) {
					sys.puts(modifiedIndel.modified.split(",")[4] + "\t" + modifiedIndel.reference.split(",")[4] + "\t" + modifiedIndel.modified.split(",")[2].length + "\t" + (parseFloat(modifiedIndel.reference.split(",")[4]) - parseFloat(modifiedIndel.modified.split(",")[4])).toFixed(1) + "\t" + showNice(modifiedIndel.modified) + "\t" + showNice(modifiedIndel.reference) + "\t" + showNice(modifiedIndel.original));
				});
			});

		});
	}
}

function showNice(indel) {
	indel = indel.replace(",", " ").replace(",", " ").replace(",", "\t");
	if (indel.split("\t")[1].length < 16) {
		indel = indel.replace(/,/g, " ") + "\t";
	}else {
		indel = indel.replace(/,/g, " ");
	}
	return indel;
}


function showInsertions(callback) {
	var changeSetsPath = "./changesets/";
	var resultsPath = "/ExamWork/Results/";
	var changeSets = fs.readdirSync(changeSetsPath);
	var result = [];
	var count = 0;
	changeSets.forEach(function(element, i) {
		if (element.indexOf(".cs") > -1) {
			var changeset = path.basename(element, ".cs");
			path.exists(resultsPath + changeset, function(exists) {
				if (exists) {
					count++;
					//sys.puts("Checking " + resultsPath + changeset + " against " + changeSetsPath + changeset + ".cs");
					getInsertions(resultsPath + changeset + "/", changeSetsPath + changeset + ".cs", function(error, results) {
						if (error) { return callback(error); }
						--count;
						//sys.puts(count);
//						if (results.modified.length > 0 || results.reference.length > 0) {
						if (results.modified.length > 0) {
//							result.push({"modified": results.modified, "reference": results.reference, "modifiedVCF": results.modifiedVCF, "referenceVCF": results.referenceVCF});
							result.push({"modified": results.modified, "modifiedVCF": results.modifiedVCF});
						}
						if (count === 0) {
							callback(null, result);
						}
					});
				}
			});
		}
	});
}

function getInsertions(resultsPath, changesetPath, callback) {
	var changesetName = path.basename(changesetPath, ".cs");
	var resultFiles = fs.readdirSync(resultsPath);
	var vcfFiles = [];
	var results = {modified: [], modifiedVCF: ""};
	
	resultFiles.forEach(function(element, i) {
		if (element.indexOf("_indels.vcf") > -1 && element.indexOf(".idx") <= -1) {
			vcfFiles.push(element);
		}
	});
	if (vcfFiles.length === 1) {
		indelsFinder.findIndels(resultsPath + "/" + vcfFiles[0], changesetPath, function(error, result) {
			if (error) { return callback(error); }
			results.modified = correctIndels(result.matches.insertions);
//			results.modified = result.matches.insertions;
			results.modifiedVCF = vcfFiles[0];
			callback(null, results);
		});
	} else {
		callback(null, results);
	}
}

function correctIndels(indels) {
	var corrected = [];
	var originalIndex = [];
	var originalIndels = {};
//	var originalIndels = {id: {modified: [], reference: []}};
	//Organize indels based on original change in changeset
	indels.forEach(function(indel) {
//		sys.error(originalIndex.indexOf(indel.original));
		if (originalIndex.indexOf(indel.original) < 0) {
			originalIndex.push(indel.original);
			originalIndels[indel.original] = {"modified": [indel.modified], "reference": [indel.reference]};
		} else {
			originalIndels[indel.original].modified.push(indel.modified);
			originalIndels[indel.original].reference.push(indel.reference);
		}
		
	});

	originalIndex.forEach(function(id) {
		corrected.push({"modified": getTrueCoverage(originalIndels[id].modified), "reference": getTrueCoverage(originalIndels[id].reference), "original": id + "," + originalIndels[id].modified.length});
	});
	
	return corrected;
	
}

function getTrueCoverage(indels) {
	var totalAltAlleles = 0;
	var bestPosition = null;
	var bestSequence = "";
	var bestDiffTo50 = 50;
	var bestTotalAlleles = 0;
	var chromosome = "";
	indels.forEach(function(indel) {
		var alt = parseFloat(indel.split(",")[5].split("/")[0]);
		var total = parseFloat(indel.split(",")[5].split("/")[1]);
		var diffTo50 = parseFloat(indel.split(",")[4]);
		totalAltAlleles += alt;
		if (diffTo50 <= bestDiffTo50) {
			bestDiffTo50 = diffTo50;
			bestTotalAlleles = total;
			bestPosition = indel.split(",")[1];
			chromosome = indel.split(",")[0];
			bestSequence = indel.split(",")[2];
		}
	});
	//Recalculate diffTo50 and percentage
	var newPercentage = parseFloat(totalAltAlleles / bestTotalAlleles) * 100;
	var newDiffTo50 = (newPercentage >= parseFloat(50)) ? newPercentage - 50 : 50 - newPercentage;

	return chromosome + "," + bestPosition + "," + bestSequence + "," + newPercentage.toFixed(1) + "," + newDiffTo50.toFixed(1) +  "," + totalAltAlleles + "/" + bestTotalAlleles;
}