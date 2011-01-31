#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");

//var log4js = require("log4js")();
//log4js.configure("../logs/config.json");

//Accepts a .sam file processed from a modified genome and outputs a file with modified coordinates
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 14, process.argv[1].length) == "/RewriteSAM.js") {
	if (process.argv.length <= 2) {
		sys.puts("Accepts a .sam file processed from a modified genome and outputs a file with modified coordinates.\nExample usage: 'node RewriteSAM.js samFilePath'");
	}
	else {
		rewriteSAM(process.argv[process.argv.length - 1], function(error, message) {
			if (error) {
				sys.puts(error.message);
				return;
			}
			sys.puts(message);
		});
	}
}

exports.rewriteSAM = rewriteSAM;

//Returns callback(error, message)
function rewriteSAM(samFilePath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	

}