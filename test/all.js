var vows = require("vows"), 
	assert = require("assert"),
	fs = require("fs");

vows.describe('GeneModifier').addBatch({
    'Get geneModifier': {
		topic: function() {
			var geneModifier = require('../GeneModifier');
			return geneModifier;
		},
	
		'should return GeneModifier with export.modifyGene': function(geneModifier) {
			assert.isFunction(geneModifier.modifyGene);
		},
		
		'substitution' : {
			topic: function(geneModifier) {
				//Create a test gene with a substitution
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.s.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with substitution': function(error, result) {
				//Should create file genes/modified/test_test.s.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.s.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.s.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.s.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.s.cs.fa", "utf8");
				
				//Compare to test/test_test.s.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.s.cs.fa");
				fs.unlinkSync("genes/modified/test_test.s.cs.offsets");
			}      
		},
		'deletion' : {
			topic: function(geneModifier) {
				//Create a test gene with a deletion
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.d.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with deletion': function(error, result) {
				//Should create file genes/modified/test_test.d.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.d.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.d.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.d.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.d.cs.fa", "utf8");
				
				//Compare to test/test_test.s.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.d.cs.fa");
				fs.unlinkSync("genes/modified/test_test.d.cs.offsets");
			}      
		},
		'insertion' : {
			topic: function(geneModifier) {
				//Create a test gene with an insertion
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.i.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with insertion': function(error, result) {
				//Should create file genes/modified/test_test.i.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.i.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.i.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.i.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.i.cs.fa", "utf8");
				
				//Compare to test/test_test.s.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.i.cs.fa");
				fs.unlinkSync("genes/modified/test_test.i.cs.offsets");
			}      
		},
    }
}).export(module);
