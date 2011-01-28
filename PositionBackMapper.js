#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var assert = require("assert");

var log4js = require("log4js")();
log4js.configure("./logs/config.json");


//Accepts the modified gene path and base position in modified gene from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 22, process.argv[1].length) == "/PositionBackMapper.js") {
	if (process.argv.length <= 3) {
		sys.puts("Returns the base position in the reference chromosome.\nExample usage: 'node PositionBackMapper.js modifiedGenePath basePositionInModifiedGene'");
	}
	else {
		backMap(process.argv[process.argv.length - 2], process.argv[process.argv.length - 1], function(error, basePositionInReferenceChromosome) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			sys.puts(basePositionInReferenceChromosome);
		});
	}
}

exports.backMap = backMap;

//Returns callback(error, basePositionInReferenceChromosome)
function backMap(modifiedGenePath, basePositionInModifiedGene) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	var modifiedPosition = parseFloat(basePositionInModifiedGene);

	//Return error id provided position is not a number
	if (isNaN(modifiedPosition)) return callback(new Error("'" + basePositionInModifiedGene + "' is not a number"));

	//Return error if modified gene does not exist
	path.exists(modifiedGenePath, function (exists) {
		if (exists && fs.statSync(modifiedGenePath).isFile()) {
/*
			var modifiedGene = fs.readFileSync(modifiedGenePath, "utf8");
			var geneDescription = modifiedGene.split("\n")[0];
			var geneSequence = modifiedGene.split("\n")[1];
*/
			var offsetsPath = modifiedGenePath.replace(path.extname(modifiedGenePath), "") + ".offsets";
			//Check that an offsets file exists
			path.exists(offsetsPath, function(existsOffsets) {
				if (existsOffsets) {

					//TODO: Check if position is out of bounds?

					//Do the actual backMapping
					var offsetDescriptor = fs.readFileSync(offsetsPath, "utf8").split("\n");
					var referencePosition = calculateReferencePosition(modifiedPosition, offsetDescriptor);

					//TODO: Return as >BRCA1 chr17:38521932 ?
					callback(null, referencePosition);
				
				} else {
					return callback(new Error("'" + offsetsPath + "' does not exist"));
				}
			});
		} else {
			return callback(new Error("The gene '" + modifiedGenePath + "' does not exist in file system"));
		}
	});
}

//Helper for resolving positions between modified files and reference genome
function calculateReferencePosition(modifiedPosition, offsetDescriptor) {
	//Find offset that is smaller than or equal to incoming position
	for (var i = (offsetDescriptor.length - 1); i >= 0; i--) {
		if (parseFloat(offsetDescriptor[i].split(",")[0]) <= modifiedPosition) {
			return modifiedPosition + parseFloat(offsetDescriptor[i].split(",")[1]);
		}
	}
	
	//If position is not affected by offsets then return as it is
	return modifiedPosition;
}
