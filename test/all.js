var vows = require("vows"), 
	assert = require("assert"),
	fs = require("fs")
	sys = require("sys");

vows.describe('GeneModifier').addBatch({
    'First 10 tests': {
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
		'substitution and insertion' : {
			topic: function(geneModifier) {
				//Create a test gene with a substitution, insertion
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.si.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with substitution and insertion': function(error, result) {
				//Should create file genes/modified/test_test.si.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.si.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.si.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.si.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.si.cs.fa", "utf8");
				
				//Compare to test/test_test.si.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.si.cs.fa");
				fs.unlinkSync("genes/modified/test_test.si.cs.offsets");
			}      
		},
		'substitution, insertion, deletion' : {
			topic: function(geneModifier) {
				//Create a test gene with a substitution, insertion, deletion
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.sid.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with substitution, insertion and deletion': function(error, result) {
				//Should create file genes/modified/test_test.sid.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.sid.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.sid.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.sid.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.sid.cs.fa", "utf8");
				
				//Compare to test/test_test.sid.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.sid.cs.fa");
				fs.unlinkSync("genes/modified/test_test.sid.cs.offsets");
			}
		},
		'substitution, deletion, insertion' : {
			topic: function(geneModifier) {
				//Create a test gene with a substitution, deletion, insertion
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.sdi.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with substitution, deletion and insertion': function(error, result) {
				//Should create file genes/modified/test_test.sdi.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.sdi.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.sdi.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.sdi.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.sdi.cs.fa", "utf8");
				
				//Compare to test/test_test.sdi.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.sdi.cs.fa");
				fs.unlinkSync("genes/modified/test_test.sdi.cs.offsets");
			}
		},
		'insertion, substitution' : {
			topic: function(geneModifier) {
				//Create a test gene with insertion, substitution
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.is.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with insertion, substitution': function(error, result) {
				//Should create file genes/modified/test_test.is.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.is.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.is.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.is.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.is.cs.fa", "utf8");
				
				//Compare to test/test_test.is.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.is.cs.fa");
				fs.unlinkSync("genes/modified/test_test.is.cs.offsets");
			}
		},
		'insertion, substitution, deletion' : {
			topic: function(geneModifier) {
				//Create a test gene with insertion, substitution, deletion
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.isd.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with insertion, substitution, deletion': function(error, result) {
				//Should create file genes/modified/test_test.isd.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.isd.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.isd.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.isd.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.isd.cs.fa", "utf8");
				
				//Compare to test/test_test.isd.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.isd.cs.fa");
				fs.unlinkSync("genes/modified/test_test.isd.cs.offsets");
			}
		},
	},
    'Second 10 tests': {
		topic: function() {
			var geneModifier = require('../GeneModifier');
			return geneModifier;
		},
	
		'should return GeneModifier with export.modifyGene': function(geneModifier) {
			assert.isFunction(geneModifier.modifyGene);
		},
		
		'insertion, deletion, substitution' : {
			topic: function(geneModifier) {
				//Create a test gene with insertion, deletion, substitution
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.ids.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with insertion, deletion, substitution': function(error, result) {
				//Should create file genes/modified/test_test.ids.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.ids.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.ids.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.ids.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.ids.cs.fa", "utf8");
				
				//Compare to test/test_test.ids.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.ids.cs.fa");
				fs.unlinkSync("genes/modified/test_test.ids.cs.offsets");
			}
		},
		'deletion, substitution' : {
			topic: function(geneModifier) {
				//Create a test gene with deletion, substitution
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.ds.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with deletion, substitution': function(error, result) {
				//Should create file genes/modified/test_test.ds.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.ds.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.ds.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.ds.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.ds.cs.fa", "utf8");
				
				//Compare to test/test_test.ds.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.ds.cs.fa");
				fs.unlinkSync("genes/modified/test_test.ds.cs.offsets");
			}
		},
		'deletion, substitution, insertion' : {
			topic: function(geneModifier) {
				//Create a test gene with deletion, substitution, insertion
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.dsi.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with deletion, substitution, insertion': function(error, result) {
				//Should create file genes/modified/test_test.dsi.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.dsi.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.dsi.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.dsi.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.dsi.cs.fa", "utf8");
				
				//Compare to test/test_test.dsi.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.dsi.cs.fa");
				fs.unlinkSync("genes/modified/test_test.dsi.cs.offsets");
			}
		},
		'deletion, insertion, substitution' : {
			topic: function(geneModifier) {
				//Create a test gene with deletion, insertion, substitution
				geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.dis.cs", this.callback);
			},
			'should not return an error': function(error, result) {
				assert.isNull(error);
			},
			'should create a gene equal to compare gene with deletion, insertion, substitution': function(error, result) {
				//Should create file genes/modified/test_test.dis.cs.fa
				var statModifiedGene = fs.statSync("genes/modified/test_test.dis.cs.fa");
				assert.isNotZero(statModifiedGene.size);

				var statOffsetDescriptor = fs.statSync("genes/modified/test_test.dis.cs.offsets");
				assert.isNotZero(statOffsetDescriptor.size);

				//Read modified and compare gene from disk
				var modifiedGene = fs.readFileSync("genes/modified/test_test.dis.cs.fa", "utf8");
				var compareGene = fs.readFileSync("test/test_test.dis.cs.fa", "utf8");
				
				//Compare to test/test_test.dis.cs.fa
				assert.equal(modifiedGene.split("\n")[1], compareGene.split("\n")[1]);
				
				//Remove the created modified gene and offset descriptions
				fs.unlinkSync("genes/modified/test_test.dis.cs.fa");
				fs.unlinkSync("genes/modified/test_test.dis.cs.offsets");
			}
		},
	},
    'Test backMapping': {
    	topic: function () {
			var geneModifier = require("../GeneModifier");
			//Create a test gene with lots of modifications
			geneModifier.modifyGene("genes/test/test.fa", "changesets/test/test.backmapping.cs", this.callback);
		},"after modifying gene for backmapping 1": {
			topic: function(result) {
				var backMapper = require("../PositionBackMapper");
				backMapper.backMap("genes/modified/test_test.backmapping.cs.fa", 38449855, this.callback);
			}, "testing 38449855": function(error, result) {
				assert.isNull(error);

				var modifiedGene = fs.readFileSync("genes/modified/test_test.backmapping.cs.fa", "utf8");
				var referenceGene = fs.readFileSync("genes/test/test.fa", "utf8");

				var geneStartPosition = parseFloat(referenceGene.split("\n")[0].split(" ")[1].split(":")[1].split("-")[0]);

				//Find base in modified gene (In insertion, should map back to T)
				var modifiedBase = "A"; //modifiedGene.split("\n")[1].substr(38449855 - geneStartPosition, 1);
				
				//Base in reference gene
				var referenceBase = referenceGene.split("\n")[1].substr(result - geneStartPosition, 1);
				
				//sys.puts((result - geneStartPosition) + ":" + (38449855 - geneStartPosition) + ":" + modifiedBase + " = " + referenceBase);
				//Compare the base chars
				assert.equal(modifiedBase, referenceBase);
				
				//Remove the created modified gene and offset descriptions
				//fs.unlinkSync("genes/modified/test_test.backmapping.cs.fa");
				//fs.unlinkSync("genes/modified/test_test.backmapping.cs.offsets");
				
			}
		},"after modifying gene for backmapping 2": {
			topic: function(result) {
				var backMapper = require("../PositionBackMapper");
				backMapper.backMap("genes/modified/test_test.backmapping.cs.fa", 38449845, this.callback);
			}, "testing 38449845": function(error, result) {
				assert.isNull(error);

				var modifiedGene = fs.readFileSync("genes/modified/test_test.backmapping.cs.fa", "utf8");
				var referenceGene = fs.readFileSync("genes/test/test.fa", "utf8");

				var geneStartPosition = parseFloat(referenceGene.split("\n")[0].split(" ")[1].split(":")[1].split("-")[0]);

				//Find base in modified gene
				var modifiedBase = modifiedGene.split("\n")[1].substr(38449845 - geneStartPosition, 1);
				
				//Base in reference gene
				var referenceBase = referenceGene.split("\n")[1].substr(result - geneStartPosition, 1);
				
				//Compare the base chars
				assert.equal(modifiedBase, referenceBase);
				
				//Remove the created modified gene and offset descriptions
				//fs.unlinkSync("genes/modified/test_test.backmapping.cs.fa");
				//fs.unlinkSync("genes/modified/test_test.backmapping.cs.offsets");
				
			}
		},"after modifying gene for backmapping 3": {
			topic: function(result) {
				var backMapper = require("../PositionBackMapper");
				backMapper.backMap("genes/modified/test_test.backmapping.cs.fa", 38449865, this.callback);
			}, "testing 38449865": function(error, result) {
				assert.isNull(error);

				var modifiedGene = fs.readFileSync("genes/modified/test_test.backmapping.cs.fa", "utf8");
				var referenceGene = fs.readFileSync("genes/test/test.fa", "utf8");

				var geneStartPosition = parseFloat(referenceGene.split("\n")[0].split(" ")[1].split(":")[1].split("-")[0]);

				//Find base in modified gene
				var modifiedBase = modifiedGene.split("\n")[1].substr(38449865 - geneStartPosition, 1);
				
				//Base in reference gene
				var referenceBase = referenceGene.split("\n")[1].substr(result - geneStartPosition, 1);
				
				//Compare the base chars
				assert.equal(modifiedBase, referenceBase);
				
				//Remove the created modified gene and offset descriptions
				//fs.unlinkSync("genes/modified/test_test.backmapping.cs.fa");
				//fs.unlinkSync("genes/modified/test_test.backmapping.cs.offsets");
				
			}
		},"after modifying gene for backmapping 4": {
			topic: function(result) {
				var backMapper = require("../PositionBackMapper");
				backMapper.backMap("genes/modified/test_test.backmapping.cs.fa", 38449875, this.callback);
			}, "testing 38449875": function(error, result) {
				assert.isNull(error);

				var modifiedGene = fs.readFileSync("genes/modified/test_test.backmapping.cs.fa", "utf8");
				var referenceGene = fs.readFileSync("genes/test/test.fa", "utf8");

				var geneStartPosition = parseFloat(referenceGene.split("\n")[0].split(" ")[1].split(":")[1].split("-")[0]);

				//Find base in modified gene
				var modifiedBase = modifiedGene.split("\n")[1].substr(38449875 - geneStartPosition, 1);
				
				//Base in reference gene
				var referenceBase = referenceGene.split("\n")[1].substr(result - geneStartPosition, 1);
				
				//Compare the base chars
				assert.equal(modifiedBase, referenceBase);
				
				//Remove the created modified gene and offset descriptions
				//fs.unlinkSync("genes/modified/test_test.backmapping.cs.fa");
				//fs.unlinkSync("genes/modified/test_test.backmapping.cs.offsets");
				
			}
		},

	}
}).export(module);
