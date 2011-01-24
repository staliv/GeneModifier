#!/usr/local/bin/node

var fs = require("fs");
var http = require("http");
var path = require("path");

//Accepts the name of the gene from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 15, process.argv[1].length) == "/GeneFetcher.js") {
	if (process.argv.length == 2) {
		console.log("Example usage: 'node GeneFetcher.js brca1'");
	}
	else {
		fetchGene(process.argv[process.argv.length - 1], function(error, fileName) {
			if (error) {
				console.log(error.message);
				return;
			}
		});
	}
}

//Returns callback(error, fileName)
function fetchGene(name) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	getGeneLocation(name, function(error, geneData) {
		if (error) {
			return callback(error);
		}
		
		outputGeneToFile(geneData, function(error, fileName) {
			if (error) {
				return callback(error);
			}
			callback(null, fileName);
		});
	});
}

exports.fetchGene = fetchGene;


//Returns callback(error, fileName)
function outputGeneToFile(geneData) {
	
	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};
	
	var geneName = geneData['value'];
	var genePosition = geneData['id'];
	var chromosomeName = genePosition.replace(/,/g, '').split(':')[0];
	var chromosomeFilePath = "./chromosomes/" + chromosomeName + ".fa";
	var start = parseFloat(genePosition.replace(/,/g, '').split(':')[1].split('-')[0]);
	var end = parseFloat(genePosition.replace(/,/g, '').split(':')[1].split('-')[1]);

	//Add expected number of line breaks - defaulting to 50 characters per line
	start += getNrOfLineBreaks(start);
	end += getNrOfLineBreaks(end);
	
	var fastaDescriptionLength = (">" + chromosomeName).length;
	
	//TODO: Check if gene exists, if not then download
	path.exists(chromosomeFilePath, function (exists) {
		if (exists) {
			var output = fs.createWriteStream("./genes/" + geneName + ".fa", {encoding: 'utf8'});
			output.write(">" + geneName + " " + genePosition + "\n");

			var geneStream = fs.createReadStream(chromosomeFilePath, {
				'bufferSize': 4 * 1024, encoding: 'utf8', 'start': start + fastaDescriptionLength, 'end': end + fastaDescriptionLength
			});
			geneStream.on("data", function(chunk) {
				output.write(chunk.replace(/\n/g, ""));
			});
			geneStream.on("end", function() {
				output.end();
				output.destroySoon();
				console.log("Created gene file: " + path.resolve("./genes/" + geneName + ".fa"));
				callback(null, path.resolve("./genes/" + geneName + ".fa"));
			});

		}
		else {
			return callback(new Error("Chromosome does not exist in file: " + path.resolve(chromosomeFilePath) + " \nCould not extract gene '" + geneName + "' from chromosome."));
		}
	});
}

function getNrOfLineBreaks(number, charsPerLine) {
	charsPerLine = (charsPerLine === undefined) ? 50: charsPerLine;
	var result = Math.floor(number/charsPerLine);

	((number % charsPerLine) === 0) ? --result : '';

	return result;
}

function getGeneLocation(geneName) {  
	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};
	
	var options = {
	  host: 'genome.ucsc.edu',
	  port: 80,
	  path: "/cgi-bin/hgSuggest?db=hg18&prefix=" + geneName
	};

	http.get(options, function(result) {
		var body = "";
		result.on('data', function(chunk) {
			body += chunk;
		});
		result.on('end', function() {
			var geneLocations = JSON.parse(body);
			if (geneLocations.length == 1) {
				console.log("Fetched gene information from " + options.host + " :");
				
				callback(null, geneLocations[0]);
			}
			else if (geneLocations.length > 1) {
				console.dir(geneLocations);
				return callback(new Error("Found multiple genes matching '" + geneName + "' from " + options.host + ". \nPlease specify one of them from the list above."));
			}
			else {
				return callback(new Error("Could not find a matching gene named '" + geneName + "' from " + options.host + "."));
			}
		})
	}).on('error', function(error) {
		console.log("Error trying to retrieve gene location from " + options.host + ": " + error.message);
		return callback(error);
	});
}
