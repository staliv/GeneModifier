exports.settings = {
	exonerate: "exonerate",
	samtools: "samtools",
	node: "node",
	bwa: "bwa",
	gatk: "java -Xms512m -Xmx2048m -jar /usr/local/lib/GenomeAnalysisTK-1.0.5315/GenomeAnalysisTK.jar -et NO_ET",
	dbSNP: "/ExamWork/dbSNP/dbsnp_130_hg18.rod",
	resultsPath: "./tmp/results/",
	modifiedGenomesPath: "./tmp/genomes/",
	referenceGenomePath: "./tmp/genomes/reference/BRCAChromosomes.fa",
	removeIntermediateFiles: true
};