#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");

var log4js = require("log4js")();
log4js.configure("logs/config.json");

//Accepts the genes from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 22, process.argv[1].length) == "/PrepareForIndexing.js") {
	if (process.argv.length <= 2) {
		sys.puts("Example usage: 'node PrepareForIndexing.js pathToGene'");
	}
	else {
		prepareForIndexing(process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			sys.puts(message);
		});
	}
}

exports.prepareForIndexing = prepareForIndexing;

//Returns callback(error, message)
function prepareForIndexing(pathToGene) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};
	
	//Check if pathToGene exists
	path.exists(pathToGene, function(exists) {
		if (exists) {
			var gene = fs.readFileSync(pathToGene, "ascii").split("\n");
			var output = [];
			output.push(gene[0] + "\n");
			output.push(insertLineBreaks(gene[1], 50));

			var preparedGeneFile = fs.openSync(path.dirname(pathToGene) + "/" + path.basename(pathToGene, ".fa") + ".lf.fa", "w");
			fs.writeSync(preparedGeneFile, output.join(""));
			fs.closeSync(preparedGeneFile);

//			fs.writeFileSync(, {encoding: "ascii"});
			//var output = fs.createWriteStream(path.dirname(pathToGene) + "/" + path.basename(pathToGene, ".fa") + ".lf.fa", {encoding: "ascii"});
			
		}
		else {
			return callback(new Error("The gene " + pathToGene + " does not exist."));
		}
	});
}

function insertLineBreaks(text, charsPerLine) {
	var newText = [];
	for (var i = 0; i < text.length; i = i + charsPerLine) {
		newText.push(text.substr(i, charsPerLine));
	}
	return newText.join("\n") + "\n";
}