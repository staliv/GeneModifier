#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var exec = require("child_process").exec;
var geneModifier = require("./GeneModifier");
var rewriteSAM = require("./utils/RewriteSAM");

var log4js = require("log4js")();
log4js.configure("./logs/config.json");

var samtools = "samtools";
var bwa = "bwa";
var cores = require("os").cpus().length;
var node = "node";
var resultsDir = "./tmp/results/"; //Must already exist
var genomesDir = "./tmp/genomes/"; //Must already exist
var referenceGenome = "./tmp/genomes/reference/BRCAChromosomes.fa"; //Must already exist

//Accepts runs a complete batch
if (process.argv.length > 1 && process.argv[1].substr(process.argv[1].length - 7, process.argv[1].length) === "/Run.js") {
	if (process.argv.length <= 2) {
		sys.puts("Example usage: 'node Run.js -g brca1,brca2 -c changesets/changeset.cs -fq /path/to/reads.fq'");
	}
	else {
		var genes = null;
		var changeset = null;
		var fastq = null;
		
		for (var i = 0; i < process.argv.length; i++) {
			if (process.argv[i] === "-g") {
				genes = process.argv[i + 1].replace(/\"/g, "").split(",");
			}
			if (process.argv[i] === "-c") {
				changeset = process.argv[i + 1].replace(/\"/g, "");
			}
			if (process.argv[i] === "-fq") {
				fastq = process.argv[i + 1].replace(/\"/g, "");
			}

		}

		if (genes !== null && changeset !== null && fastq !== null) {
			var startTime = new Date().getTime();
			run(genes, changeset, function(error, message) {
				if (error) {
					sys.puts(error.message);
					return;
				}
				var endTime = new Date().getTime();
				var jobTime = Math.round((endTime - startTime) / 1000);
				console.log("Job completed on " + cores + " cores in " + jobTime + " seconds, created: " + message + ".");
			});
		} else {
			sys.puts("Error in command line.")
		}
	}
}


//Returns callback(error, message)
function run(genes, changeSet) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	var rewrittenSAMPath = null;
	var referenceSAMPath = null;

	console.log("Running job with " + cores + " cores.");

	//Modify genes
	modifyGenes(genes, changeSet, function(error, createdFiles) {
		if (error) { return callback(error); }

		//Cat the modified genes to a single file
		combineGenes(createdFiles, changeSet, function(error, fileName) {
			
			//Index with bwa
			console.log("Begin indexing of modified genome " + fileName + "...")
			exec(bwa + " index " + fileName, function (error, stdout, stderr) {
				if (error) { return callback(error); }
				console.log("Finished indexing modified genome.")
				//Align
				console.log("Aligning modified genome with " + fastq + "...");
				var saiFile = path.dirname(fileName) + "/" + path.basename(fileName, ".fa") + ".sai";
				exec(bwa + " aln -t " + cores + " " + fileName + " " + fastq + " > " + saiFile, function (error, stdout, stderr) {
					if (error) { return callback(error); }
					console.log("Finished alignment against modified genome.");
					//Create SAM
					console.log("Creating modified SAM file...");
					var samFile = path.dirname(saiFile) + "/" + path.basename(saiFile, ".sai") + ".sam";
					exec(bwa + " samse " + fileName + " " + saiFile + " " + fastq + " > " + samFile, function (error, stdout, stderr) {
						if (error) { return callback(error); }
						console.log("Finished creating modified SAM with path: " + samFile);
						
						//Rewrite SAM file
						console.log("Rewriting modified SAM...");
						rewrittenSAM = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".rewritten.sam";
						exec(node + " utils/RewriteSAM.js " + samFile + " > " + rewrittenSAM, function (error, stdout, stderr) {
							if (error) { return callback(error); }
							console.log("Finished rewriting modified SAM to: " + rewrittenSAM + ".");
							rewrittenSAMPath = rewrittenSAM;
							if (referenceSAMPath !== null) {
								continueWithSorting(rewrittenSAMPath, referenceSAMPath, changeSet, function(error, message) {
									if (error) { return callback(error); }
									callback(message);
								});
							}
						});
						
					});
					
				});
			});
		});
	});

	//Index reference genome with bwa
//	console.log("Begin indexing of reference genome " + referenceGenome + "...")
	//TODO: maybe not?
//	exec(bwa + " index -a bwtsw " + referenceGenome, function (error, stdout, stderr) {
//		if (error) { return callback(error); }
//		console.log("Finished indexing reference genome.");
		
		var saiFile = resultsDir + path.basename(changeSet, ".cs") + "/" + "reference.sai";
		
		path.exists(path.dirname(saiFile), function(exists) {
			if (!exists) {
				fs.mkdirSync(path.dirname(saiFile), 0700);
			}

			console.log("Aligning reference genome with " + fastq + "...");
			//Align
			exec(bwa + " aln -t " + cores + " " + referenceGenome + " " + fastq + " > " + saiFile, function (error, stdout, stderr) {
				if (error) { return callback(error); }
				console.log("Finished alignment against reference genome.");
	
				console.log("Creating SAM for reference genome...")
				var samFile = path.dirname(saiFile) + "/" + path.basename(saiFile, ".sai") + ".sam";
				exec(bwa + " samse " + referenceGenome + " " + saiFile + " " + fastq + " > " + samFile, function (error, stdout, stderr) {
					if (error) { return callback(error); }

					console.log("Finished creating SAM file for reference genome: " + samFile);
					//Add score to reference alignment
					console.log("Adding score to reference SAM...")
					var scoredSAM = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".scored.sam";
					exec(node + " utils/AddScoreToSAM.js " + samFile + " > " + scoredSAM, function (error, stdout, stderr) {
						referenceSAMPath = scoredSAM;
						console.log("Finished scoring: " + scoredSAM);
						if (rewrittenSAMPath !== null) {
							continueWithSorting(rewrittenSAMPath, referenceSAMPath, changeSet, function(error, message) {
								if (error) { return callback(error); }
								callback(null, message);
							});
						}
					
					});
				});
			});
		});		
//	});
	
}

function continueWithSorting(rewrittenSAMPath, referenceSAMPath, changeSet) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	var doneSortingRewritten = null;
	var doneSortingReference = null;

	console.log("Convert rewritten SAM to BAM...");
	var rewrittenBAM = path.dirname(rewrittenSAMPath) + "/" + path.basename(rewrittenSAMPath, ".sam") + ".bam";
	exec(samtools + " view -S -b -h -o " + rewrittenBAM + " " + rewrittenSAMPath, function(error, stdout, stderr) {
		if (error) { return callback(error); }
		console.log("Finished converting rewritten SAM to BAM: " + rewrittenBAM + ".");

		//Sort
		var sortedRewrittenBAM = path.dirname(rewrittenBAM) + "/" + path.basename(rewrittenBAM) + ".sorted";
		exec(samtools + " sort -n " + rewrittenBAM + " " + sortedRewrittenBAM, function(error, stdout, stderr) {
			if (error) { return callback(error); }

			sortedRewrittenBAM += ".bam";
			doneSortingRewritten = sortedRewrittenBAM;
			console.log("Sorted rewritten BAM to " + doneSortingRewritten);
			
			if (doneSortingReference) {
				mergeAndKeep(doneSortingRewritten, doneSortingReference, referenceSAMPath, function(error, message) {
					if (error) { return callback(error); }
					callback(null, message);		
				});
			} 
			
		});
		
		
	});

	console.log("Convert reference SAM to BAM...");
	var referenceBAM = path.dirname(referenceSAMPath) + "/" + path.basename(referenceSAMPath, ".sam") + ".bam";
	exec(samtools + " view -S -b -h -o " + referenceBAM + " " + referenceSAMPath, function(error, stdout, stderr) {
		if (error) { return callback(error); }
		console.log("Finished converting reference SAM to BAM: " + referenceBAM + ".");

		//Sort
		var sortedReferenceBAM = path.dirname(referenceBAM) + "/" + path.basename(referenceBAM) + ".sorted";
		exec(samtools + " sort -n " + referenceBAM + " " + sortedReferenceBAM, function(error, stdout, stderr) {
			if (error) { return callback(error); }

			sortedReferenceBAM += ".bam";
			doneSortingReference = sortedReferenceBAM;
			console.log("Sorted reference BAM to " + doneSortingReference);
			
			if (doneSortingRewritten) {
				mergeAndKeep(doneSortingRewritten, doneSortingReference, referenceSAMPath, function(error, message) {
					if (error) { return callback(error); }
					callback(null, message);
				});
			} 
			
		});

	});
	
}

function mergeAndKeep(rewrittenBAM, referenceBAM, referenceSAMPath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	//Merge bam files
	console.log("Merging BAM files...");
	var mergedFile = path.dirname(referenceBAM) + "/" + path.basename(rewrittenBAM, ".sorted.bam") + "_" + path.basename(referenceBAM, ".sorted.bam") + ".bam";
	exec(samtools + " merge -rn -h " + referenceSAMPath + " " + mergedFile + " " + referenceBAM + " " + rewrittenBAM, function(error, stdout, stderr) {
		if (error) { return callback(error); }
		console.log("Finished merging BAM files to: " + mergedFile);
		
		//Convert BAM to SAM
		console.log("Convert merged BAM file to SAM...");
		var samFile = path.dirname(mergedFile) + "/" + path.basename(mergedFile, ".bam") + ".sam";
		exec(samtools + " view -h -o " + samFile + " " + mergedFile, function(error, stdout, stderr) {
			if (error) { return callback(error); }
			console.log("Finished converting to: " + samFile);
			
			//Keep best match
			console.log("Keeping best match in SAM file...");
			var cleanedSAM = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".cleaned.sam";
			exec(node + " utils/KeepBestMatch.js " + samFile + " > " + cleanedSAM, function(error, stdout, stderr) {
				if (error) { return callback(error); }
				console.log("Finished cleaning SAM file: " + cleanedSAM);
				
				//Convert to BAM
				console.log("Converting " + cleanedSAM + " to BAM...");
				var cleanedBAM = path.dirname(cleanedSAM) + "/" + path.basename(cleanedSAM, ".sam") + ".bam";
				exec(samtools + " view -h -S -b -o " + cleanedBAM + " " + cleanedSAM, function(error, stdout, stderr) {
					if (error) { return callback(error); }
					console.log("Finished conversion to: " + cleanedBAM);

					//Sort again, this time according to position
					console.log("Sorting finished BAM according to position...")
					var sortedCleanedBAM = path.dirname(cleanedBAM) + "/" + path.basename(cleanedBAM, ".bam") + ".sorted";
					exec(samtools + " sort " + cleanedBAM + " " + sortedCleanedBAM, function(error, stdout, stderr) {
						if (error) { return callback(error); }
						sortedCleanedBAM += ".bam";
						console.log("Finished sorting to: " + sortedCleanedBAM);
					
						//Index the BAM file
						console.log("Indexing " + sortedCleanedBAM + "...");
						exec(samtools + " index " + sortedCleanedBAM, function(error, stdout, stderr) {
							if (error) { return callback(error); }
							console.log("Finished indexing of " + sortedCleanedBAM);
							callback(null, sortedCleanedBAM);
							
						});
					});
				
				});
			});
		});
	});
}

function combineGenes(createdFiles, changeSet) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};
	
	var outputFileName = genomesDir + path.basename(changeSet, ".cs") + "/" + path.basename(changeSet, ".cs") + ".fa";

	path.exists(path.dirname(outputFileName), function(exists) {
		if (!exists) {
			fs.mkdirSync(path.dirname(outputFileName), 0700);
		}

		var child = exec("cat " + createdFiles.join(" ") + " > " + outputFileName, function (error, stdout, stderr) {
			if (error) { return callback(error); }
		
			console.log("Combined files to " + outputFileName + ".");
			callback(null, outputFileName);
		});

	});


	
}


function modifyGenes(genes, changeSet) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	var count = 0;
	var createdFiles = [];

	console.log("Begin modification of genes " + genes + "...");

	//Modify genes with changeset
	for (var i = 0; i < genes.length; i++) {
		var gene = trim(genes[i]);
		
		geneModifier.modifyGene(gene, changeSet, function(error, createdFile) {
			if (error) { return callback(error); }
			createdFiles.push(createdFile);
			count++;
			if (count === genes.length) {
				//Done
				console.log("Done with gene modification.")
				callback(null, createdFiles);
			}
		});
	}

}


function trim(string) {
    return string.replace(/^\s*|\s*$/, '')
}
