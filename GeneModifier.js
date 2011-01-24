#!/usr/local/bin/node

var fs = require("fs");
var http = require("http");
var path = require("path");

getGeneLocation("BRCA2");

function outputGene(geneData) {
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
			fs.createReadStream(chromosomeFilePath, {
				'bufferSize': 4 * 1024, 'start': start + fastaDescriptionLength, 'end': end + fastaDescriptionLength
			}).pipe(output)
		}
		else {
			throw new Error(chromosomeFilePath + " - path does not exist.");
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
			if (geneLocations.length > 0) {
				outputGene(geneLocations[0]);
			}
		})
	}).on('error', function(error) {
		console.log("Got error: " + error.message);
	});
}