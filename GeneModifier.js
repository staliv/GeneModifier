#!/usr/local/bin/node

var fs = require("fs");
var http = require("http");
var path = require("path");
var geneFetcher = require("./GeneFetcher");

//Accepts the name of the gene and changeset from command line
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 16, process.argv[1].length) == "/GeneModifier.js") {
	if (process.argv.length <= 3) {
		console.log("Example usage: 'node GeneModifier.js geneName changeSetName'");
	}
	else {
		modifyGene(process.argv[process.argv.length - 2], process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				console.log(error.message);
				return;
			}
			console.log(message);
		});
	}
}

//Returns callback(error, message)
function modifyGene(geneName, changeSetName) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};
	
	//Return with error if arguments are not correctly passed
	if (!geneName || !changeSetName) return callback(new Error("Missing name of gene or changeSet"));
	
	//Does gene already exist?
	path.exists("./genes/" + geneName.toUpperCase() + ".fa", function (exists) {
		if (!exists) {
			//Otherwise fetch gene
			geneFetcher.fetchGene(geneName, function(error, filePath) {
				if (error) return callback(error);
				//Try again with the same callback
				modifyGene(path.basename(filePath, ".fa"), changeSetName, callback);
			});
		}
		else {
			//Does changeSet exist?
			path.exists("./changesets/" + changeSetName, function (exists) {
				if (!exists) {
					return callback(new Error("ChangeSet " + path.resolve("./changesets/" + changeSetName) + " does not exist."));
				}
				callback(null, "GeneModifier has no logic for outputting the modified gene yet.");
			});
		}
		
	});
	
}