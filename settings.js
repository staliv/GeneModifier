exports.settings = {
	exonerate: "exonerate",
	samtools: "samtools",
	node: "node",
	bwa: "bwa",
	novoalign: "novoalign",
	novoindex: "novoindex",
	gatk: "java -Xms512m -Xmx2048m -jar /usr/local/lib/GenomeAnalysisTK-1.0.5315/GenomeAnalysisTK.jar -et NO_ET",
	gatkInterval: "chr13:31785617-31873809;chr17:38447838-38533026", //	gatkInterval: "chr13:31787617-31871809;chr17:38449838-38531026", 
	gatkLogLevel: "INFO", //INFO, ERROR, FATAL
	downSampleToCoverage: 40000,
	dbSNP: "/ExamWork/dbSNP/dbsnp_130_hg18.rod",
	resultsPath: "./tmp/results/",
	modifiedGenomesPath: "./tmp/genomes/",
	referenceGenomePath: "./tmp/genomes/reference/BRCAChromosomes.fa",
	removeIntermediateFiles: true
};