#!/usr/local/bin/node

var fs = require("fs");
var path = require("path");
var sys = require("sys");
var exec = require("child_process").exec;
var geneModifier = require("./GeneModifier");
var rewriteSAM = require("./utils/RewriteSAM");
var settings = require("./settings").settings;

var log4js = require("./node_modules/log4js")();
log4js.configure("./logs/config.json");

var cores = require("os").cpus().length;

var samtools = settings.samtools;
var bwa = settings.bwa;
var node = settings.node;
var resultsDir = settings.resultsPath; //Must already exist
var genomesDir = settings.modifiedGenomesPath; //Must already exist
var referenceGenome = settings.referenceGenomePath; //Must already exist
var removeIntermediateFiles = settings.removeIntermediateFiles; //Removes all files that are not part of the result set
var gatk = settings.gatk;

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
			sys.puts("Error in command line when calling Run.js.");
			if (genes === null) {
				sys.puts("\t- Genes are not specified");
			}
			if (changeset === null) {
				sys.puts("\t- Changeset is not specified");
			}
			if (fastq === null) {
				sys.puts("\t- FastQ is not specified");
			}
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
			console.log("Begin indexing of modified genome " + fileName + "...");
			exec(bwa + " index " + fileName, function (error, stdout, stderr) {
				if (error) { return callback(error); }
				console.log("Finished indexing modified genome.");
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
						console.log("Finished creating modified SAM with path: " + samFile + ".");
						
						if (removeIntermediateFiles) {
							fs.unlinkSync(saiFile);
							fs.unlinkSync(fileName);
							fs.unlinkSync(fileName + ".amb");
							fs.unlinkSync(fileName + ".ann");
							fs.unlinkSync(fileName + ".bwt");
							fs.unlinkSync(fileName + ".pac");
							fs.unlinkSync(fileName + ".rbwt");
							fs.unlinkSync(fileName + ".rpac");
							fs.unlinkSync(fileName + ".rsa");
							fs.unlinkSync(fileName + ".sa");
						}
						
						//Rewrite SAM file
						console.log("Rewriting modified SAM...");
						rewrittenSAM = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".rewritten.sam";
						exec(node + " utils/RewriteSAMParallel.js " + samFile + " > " + rewrittenSAM, function (error, stdout, stderr) {
							if (error) { return callback(error); }
							console.log("Finished rewriting modified SAM to: " + rewrittenSAM + ".");

							if (removeIntermediateFiles){
								console.log("Removing " + samFile);
								fs.unlinkSync(samFile);
							}

							rewrittenSAMPath = rewrittenSAM;

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

											console.log("Creating SAM for reference genome...");
											var samFile = path.dirname(saiFile) + "/" + path.basename(saiFile, ".sai") + ".sam";
											exec(bwa + " samse " + referenceGenome + " " + saiFile + " " + fastq + " > " + samFile, function (error, stdout, stderr) {
												if (error) { return callback(error); }
												console.log("Finished creating SAM file for reference genome: " + samFile);

												if (removeIntermediateFiles) {
													console.log("Removing " + saiFile);
													fs.unlinkSync(saiFile);
												}

												//Add score to reference alignment
												console.log("Adding score to reference SAM...");
												var scoredSAM = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".scored.sam";
												exec(node + " utils/AddScoreToSAM.js " + samFile + " > " + scoredSAM, function (error, stdout, stderr) {
													referenceSAMPath = scoredSAM;
													console.log("Finished scoring: " + scoredSAM);

													if (removeIntermediateFiles) {
														console.log("Removing " + samFile);
														fs.unlinkSync(samFile);
													}

													continueWithSorting(rewrittenSAMPath, referenceSAMPath, changeSet, function(error, message) {
														if (error) { return callback(error); }
														callback(null, message);
													});
												});
											});
										});
									});		
							//	});
						});
					});
				});
			});
		});
	});

}

function continueWithSorting(rewrittenSAMPath, referenceSAMPath, changeSet) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	var doneSortingRewritten = null;
	var doneSortingReference = null;

	//Add headers from reference sam to rewritten sam
	var headers = path.dirname(referenceSAMPath) + "/SAMHeaders.sam";
	console.log("Extract headers from " + referenceSAMPath + "...");
	exec(samtools + " view -S -H -o " + headers + " " + referenceSAMPath, function(error, stdout, stderr) {
		if (error) { return callback(error); }
		console.log("Finished extracting headers.");
		
		console.log("Add headers to rewritten SAM...");
		var withHeadersPath = path.dirname(rewrittenSAMPath) + "/" + path.basename(rewrittenSAMPath, ".sam") + ".headers.sam";
		exec("cat " + headers + " " + rewrittenSAMPath + " > " + withHeadersPath, function(error, stdout, stderr) {
			if (error) { return callback(error); }

			if (removeIntermediateFiles) {
				console.log("Removing " + headers);
				fs.unlinkSync(headers);
				console.log("Removing " + rewrittenSAMPath);
				fs.unlinkSync(rewrittenSAMPath);
			}
			
			rewrittenSAMPath = withHeadersPath;
			console.log("Finished adding headers to  " + rewrittenSAMPath + "...");
	
			console.log("Convert rewritten SAM to BAM...");
			var rewrittenBAM = path.dirname(rewrittenSAMPath) + "/" + path.basename(rewrittenSAMPath, ".sam") + ".bam";
			exec(samtools + " view -S -b -h -o " + rewrittenBAM + " " + rewrittenSAMPath, function(error, stdout, stderr) {
				if (error) { return callback(error); }
				console.log("Finished converting rewritten SAM to BAM: " + rewrittenBAM + ".");

				if (removeIntermediateFiles) {
					console.log("Removing " + rewrittenSAMPath);
					fs.unlinkSync(rewrittenSAMPath);
				}

				//Sort
				var sortedRewrittenBAM = path.dirname(rewrittenBAM) + "/" + path.basename(rewrittenBAM, ".bam") + ".sorted";
				exec(samtools + " sort -n " + rewrittenBAM + " " + sortedRewrittenBAM, function(error, stdout, stderr) {
					if (error) { return callback(error); }

					if (removeIntermediateFiles) {
						console.log("Removing " + rewrittenBAM);
						fs.unlinkSync(rewrittenBAM);
					}
		
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
		
				if (removeIntermediateFiles) {
					console.log("Removing " + referenceSAMPath);
					fs.unlinkSync(referenceSAMPath);
				}
		
				//Sort
				console.log("Sorting reference BAM...");
				var sortedReferenceBAM = path.dirname(referenceBAM) + "/" + path.basename(referenceBAM, ".bam") + ".sorted";
				exec(samtools + " sort -n " + referenceBAM + " " + sortedReferenceBAM, function(error, stdout, stderr) {
					if (error) { return callback(error); }
		
					sortedReferenceBAM += ".bam";

					if (removeIntermediateFiles) {
						console.log("Removing " + referenceBAM);
						fs.unlinkSync(referenceBAM);
					}

					console.log("Sorted reference BAM to: " + sortedReferenceBAM);

					doneSortingReference = sortedReferenceBAM;

					if (doneSortingRewritten) {
						mergeAndKeep(doneSortingRewritten, doneSortingReference, referenceSAMPath, function(error, message) {
							if (error) { return callback(error); }
							callback(null, message);
						});
					} 
				});
			});
		});
	});	
}


function mergeAndKeep(rewrittenBAM, referenceBAM, referenceSAMPath) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	var referenceBAMFinished = null;
	var modifiedBAMFinished = null;

	//Merge bam files
	console.log("Merging BAM files...");
	var mergedFile = path.dirname(referenceBAM) + "/" + path.basename(rewrittenBAM, ".sorted.bam") + "_" + path.basename(referenceBAM, ".sorted.bam") + ".bam";
//	exec(samtools + " merge -rn -h " + referenceSAMPath + " " + mergedFile + " " + referenceBAM + " " + rewrittenBAM, function(error, stdout, stderr) {
	exec(samtools + " merge -rn " + mergedFile + " " + referenceBAM + " " + rewrittenBAM, function(error, stdout, stderr) {
		if (error) { return callback(error); }
		console.log("Finished merging BAM files to: " + mergedFile);

		if (removeIntermediateFiles) {
			console.log("Removing " + rewrittenBAM);
			fs.unlinkSync(rewrittenBAM);
		}

		//Sort
		console.log("Classic sorting of reference BAM...");
		var sortedReferenceBAM = path.dirname(referenceBAM) + "/" + path.basename(referenceBAM, ".sorted.bam") + ".csorted";
		exec(samtools + " sort " + referenceBAM + " " + sortedReferenceBAM, function(error, stdout, stderr) {
			if (error) { return callback(error); }

			sortedReferenceBAM += ".bam";
			console.log("Finished classic sorting of reference BAM to: " + sortedReferenceBAM + ".");

			if (removeIntermediateFiles) {
				console.log("Removing " + referenceBAM);
				fs.unlinkSync(referenceBAM);
			}

			//Index the BAM file
			console.log("Indexing " + sortedReferenceBAM + "...");
			exec(samtools + " index " + sortedReferenceBAM, function(error, stdout, stderr) {
				if (error) { return callback(error); }
				console.log("Finished indexing " + sortedReferenceBAM + ".");
				referenceBAMFinished = sortedReferenceBAM;
				if (modifiedBAMFinished !== null) {
					initiateVariantCalling([modifiedBAMFinished, referenceBAMFinished], function(error, message) {
						if (error) { return callback(error); }
						callback(null, message);
					});
				}
			});
		});

		//Convert BAM to SAM
		console.log("Convert merged BAM file to SAM...");
		var samFile = path.dirname(mergedFile) + "/" + path.basename(mergedFile, ".bam") + ".sam";
		exec(samtools + " view -h -o " + samFile + " " + mergedFile, function(error, stdout, stderr) {
			if (error) { return callback(error); }
			console.log("Finished converting to: " + samFile);

			if (removeIntermediateFiles) {
				console.log("Removing " + mergedFile);
				fs.unlinkSync(mergedFile);
			}
			
			//Keep best match
			console.log("Keeping best match in SAM file...");
			var cleanedSAM = path.dirname(samFile) + "/" + path.basename(samFile, ".sam") + ".cleaned.sam";
			exec(node + " utils/KeepBestMatch.js " + samFile + " > " + cleanedSAM, function(error, stdout, stderr) {
				if (error) { return callback(error); }
				console.log("Finished cleaning SAM file: " + cleanedSAM);

				if (removeIntermediateFiles) {
					console.log("Removing " + samFile);
					fs.unlinkSync(samFile);
				}
				
				//Convert to BAM
				console.log("Converting " + cleanedSAM + " to BAM...");
				var cleanedBAM = path.dirname(cleanedSAM) + "/" + path.basename(cleanedSAM, ".sam") + ".bam";
				exec(samtools + " view -h -S -b -o " + cleanedBAM + " " + cleanedSAM, function(error, stdout, stderr) {
					if (error) { return callback(error); }
					console.log("Finished conversion to: " + cleanedBAM);

					if (removeIntermediateFiles) {
						console.log("Removing " + cleanedSAM);
						fs.unlinkSync(cleanedSAM);
					}

					//Sort again, this time according to position
					console.log("Sorting finished BAM according to position...");
					var sortedCleanedBAM = path.dirname(cleanedBAM) + "/" + path.basename(cleanedBAM, ".bam") + ".sorted";
					exec(samtools + " sort " + cleanedBAM + " " + sortedCleanedBAM, function(error, stdout, stderr) {
						if (error) { return callback(error); }
						sortedCleanedBAM += ".bam";
						console.log("Finished sorting to: " + sortedCleanedBAM);

						if (removeIntermediateFiles) {
							console.log("Removing " + cleanedBAM);
							fs.unlinkSync(cleanedBAM);
						}
					
						//Index the BAM file
						console.log("Indexing " + sortedCleanedBAM + "...");
						exec(samtools + " index " + sortedCleanedBAM, function(error, stdout, stderr) {
							if (error) { return callback(error); }
							console.log("Finished indexing of " + sortedCleanedBAM);

							modifiedBAMFinished = sortedCleanedBAM;
							if (referenceBAMFinished !== null) {
								initiateVariantCalling([modifiedBAMFinished, referenceBAMFinished], function(error, message) {
									if (error) { return callback(error); }
									callback(null, message);
								});
							}
						});
					});
				});
			});
		});
	});
}

function initiateVariantCalling(bamFiles) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	console.log("Starting variant and indel calling...");
	
	performVariantCalling(bamFiles[0], function(error, message) {
		if (error) { return callback(error); }

		performVariantCalling(bamFiles[1], function(error, message) {
			if (error) { return callback(error); }
			console.log("Finished variant and indel calling.");
			callback(null, "OK");
		});
	});
}

/*
java -jar /bin/GTK/GenomeAnalysisTK.jar -T RealignerTargetCreator -R /seq/REFERENCE/human_18.fasta -I /output/FOO.sorted.bam  -o /output/FOO.intervals
java -jar /bin/GTK/GenomeAnalysisTK.jar -T IndelRealigner -R /seq/REFERENCE/human_18.fasta -I /output/FOO.sorted.bam -targetIntervals /output/FOO.intervals --output /output/FOO.sorted.realigned.bam
//samtools calmd -Abr FOO.sorted.bam human_18.fasta > FOO.baq.bam
samtools index /output/FOO.sorted.realigned.bam /output/FOO.sorted.realigned.bam.bai
java -jar /bin/GTK/GenomeAnalysisTK.jar -T IndelGenotyperV2 -R /seq/REFERENCE/human_18.fasta -I /output/FOO.sorted.realigned.bam -O /output/FOO_indel.txt --verbose -o /output/FOO_indel_statistics.txt
java -jar /bin/GTK/GenomeAnalysisTK.jar -T UnifiedGenotyper -R /seq/REFERENCE/human_18.fasta -I /output/FOO.sorted.realigned.bam -varout /output/FOO.geli.calls -stand_call_conf 30.0 -stand_emit_conf 10.0 -pl SOLEXA	
*/

function performVariantCalling(bamFile) {

	var callback = arguments[arguments.length - 1];
	if (typeof(callback) !== 'function') callback = function(){};

	console.log("Begin variant calling on " + bamFile + "...");

	console.log("Identify target regions for realignment...");
//	java -jar /bin/GTK/GenomeAnalysisTK.jar -T RealignerTargetCreator -R /seq/REFERENCE/human_18.fasta -I /output/FOO.sorted.bam  -o /output/FOO.intervals
	var intervalsDescriptor = path.dirname(bamFile) + "/" + path.basename(bamFile, ".bam") + ".intervals";
	exec(gatk + " -T RealignerTargetCreator -R " + referenceGenome + " -I " + bamFile + " -o " + intervalsDescriptor, function(error, stdout, stderr) {
		if (error) { return callback(error); }
		console.log("Finished identifying target regions.");
		
		console.log("Realign BAM to get better Indel calling...");
		//	java -jar /bin/GTK/GenomeAnalysisTK.jar -T IndelRealigner -R /seq/REFERENCE/human_18.fasta -I /output/FOO.sorted.bam -targetIntervals /output/FOO.intervals --output /output/FOO.sorted.realigned.bam
		var realignedBAM = path.dirname(bamFile) + "/" + path.basename(bamFile, ".bam") + ".realigned.bam";
		exec(gatk + " -T IndelRealigner -R " + referenceGenome + " -I " + bamFile + " -targetIntervals " + intervalsDescriptor + " -o " + realignedBAM, function(error, stdout, stderr) {
			if (error) { return callback(error); }
			console.log("Finished realigning for indels.");

			if (removeIntermediateFiles) {
				console.log("Removing " + intervalsDescriptor);
				fs.unlinkSync(intervalsDescriptor);
			}
			
			console.log("Calculate BAQ...");
			//	samtools calmd -ru FOO.sorted.bam human_18.fasta > FOO.baq.bam
			//	or with gatk?
			var baqBAM = path.dirname(realignedBAM) + "/" + path.basename(realignedBAM, ".bam") + ".baq.bam";
			exec(samtools + " calmd -br " + realignedBAM + " " + referenceGenome + " > " + baqBAM, function(error, stdout, stderr) {
				if (error) { return callback(error); }
				console.log("Finished calculating BAQ to : " + baqBAM + ".");

				if (removeIntermediateFiles) {
					console.log("Removing " + realignedBAM);
					fs.unlinkSync(realignedBAM);
				}
				
				console.log("Reindex the realigned BAM...");
				//	samtools index /output/FOO.sorted.realigned.bam /output/FOO.sorted.realigned.bam.bai
				exec(samtools + " index " + baqBAM, function(error, stdout, stderr) {
					if (error) { return callback(error); }
					console.log("Finished reindexing the realigned BAM.");
					
					console.log("Call Indels...");
					//	java -jar /bin/GTK/GenomeAnalysisTK.jar -T IndelGenotyperV2 -R /seq/REFERENCE/human_18.fasta -I /output/FOO.sorted.realigned.bam -O /output/FOO_indel.txt --verbose -o /output/FOO_indel_statistics.txt
//					java -jar GenomeAnalysisTK.jar –R ref.fasta -T UnifiedGenotyper –L mytargets.list –I myreads.bam –o mycalls.vcf -B:dbsnp,VCF dbsnp.vcf -glm DINDEL
//					var indelStats = path.dirname(baqBAM) + "/" + path.basename(baqBAM, ".realigned.baq.bam") + "_indel_stats.txt";
					var indels = path.dirname(baqBAM) + "/" + path.basename(baqBAM, ".realigned.baq.bam") + "_indels.vcf";
//					exec(gatk + " -T IndelGenotyperV2 -R " + referenceGenome + " -I " + baqBAM + " -O " + indels + " --verbose -o " + indelStats, function(error, stdout, stderr) {
					exec(gatk + " -T UnifiedGenotyper -R " + referenceGenome + " -I " + baqBAM + " -o " + indels + " -D " + settings.dbSNP + " -glm DINDEL -nt " + cores, function(error, stdout, stderr) {
						if (error) { return callback(error); }
						console.log("Finished calling indels.");
						
						console.log("Call SNPs...");
						//	java -jar /bin/GTK/GenomeAnalysisTK.jar -T UnifiedGenotyper -R /seq/REFERENCE/human_18.fasta -I /output/FOO.sorted.realigned.bam -varout /output/FOO.geli.calls -stand_call_conf 30.0 -stand_emit_conf 10.0 -pl SOLEXA	
						var SNP = path.dirname(baqBAM) + "/" + path.basename(baqBAM, ".realigned.baq.bam") + "_snps.vcf";
						exec(gatk + " -T UnifiedGenotyper -R " + referenceGenome + " -I " + baqBAM + " -D " + settings.dbSNP + " -o " + SNP + " -nt" + cores, function(error, stdout, stderr) {
							if (error) { return callback(error); }
							console.log("Finished calling SNPs.");
							console.log("Finished variant calling on " + bamFile);
							
							callback(null, "OK");
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
				console.log("Done with gene modification.");
				callback(null, createdFiles);
			}
		});
	}
}


function trim(string) {
    return string.replace(/^\s*|\s*$/, '');
}
