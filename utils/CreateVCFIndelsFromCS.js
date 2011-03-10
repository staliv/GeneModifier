#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var fileLineReader = require("./FileLineReader");

var log4js = require("../node_modules/log4js")();
log4js.configure("logs/config.json");

//Accepts the changeset path from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 25, process.argv[1].length) == "/CreateVCFIndelsFromCS.js") {
	if (process.argv.length <= 2) {
		sys.puts("Example usage: 'node CreateVCFIndelsFromCS.js pathToChangeSet'");
	}
	else {
		createVCF(process.argv[process.argv.length - 1], function(error, vcf) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			sys.puts(vcf);
		});
	}
}

exports.createVCF = createVCF;

//Returns callback(error, newSAMFilePath)
function createVCF(file) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	path.exists(file, function(exists) {
		if (exists) {
			var lineReader = fileLineReader.FileLineReader(file, 1024 * 128),
				line = null,
				splitLine = [],
				vcf = [];
				
			vcf.push("##fileformat=VCFv4.0");
			vcf.push("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT");
				
			while (true) {
				line = lineReader.nextLine();
				splitLine = line.split("\t");
				if (line.substr(0, 1) !== "#") {
					var referenceBase = null;
					if (splitLine[3].substr(0, 1) === "I") {
						referenceBase = getReferenceBase(splitLine[0], parseFloat(splitLine[1]) - 1);
						vcf.push(splitLine[0] + "\t" + splitLine[1] + "\t.\t" + referenceBase + "\t" + referenceBase + splitLine[5] + "\t.\t.\t.\t.");
					}

					if (splitLine[3].substr(0, 1) === "D") {
						referenceBase = getReferenceBase(splitLine[0], parseFloat(splitLine[1]) - 1);
						vcf.push(splitLine[0] + "\t" + splitLine[1] + "\t.\t" + referenceBase + splitLine[4] + "\t" + referenceBase + "\t.\t.\t.\t.");
					}
				
					if (!lineReader.hasNextLine()) {
						break;
					}
				}
			}

			callback(null, vcf.join("\n"));
			
		} else {
			return callback(new Error("The changeset '" + file + "' does not exist."));		
		}
	});
}

function getReferenceBase(chromosomeName, referencePosition) {

	var readLength = 1;
	//Reference position should be 0-based
	var headerLength = (">" + chromosomeName).length + 1;
	var start = referencePosition + getNrOfLineBreaks(referencePosition) + headerLength;
	var end = referencePosition + readLength + getNrOfLineBreaks(referencePosition + readLength) + headerLength;

//	sys.error(start + " - " + end);
	var chromosomeFile = fs.openSync("./chromosomes/" + chromosomeName + ".fa", "r");
	var referenceSequence = fs.readSync(chromosomeFile, end - start, start, "ascii")[0].replace(/\n/g, "").toUpperCase();
	fs.closeSync(chromosomeFile);
	
	return referenceSequence;
}

function getNrOfLineBreaks(number, charsPerLine) {
	charsPerLine = (charsPerLine === undefined) ? 50: charsPerLine;
	var result = Math.floor(number/charsPerLine);

	((number % charsPerLine) === 0) ? --result : '';

	return result;
}
