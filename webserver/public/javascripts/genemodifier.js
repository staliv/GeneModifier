$(document).ready(function() {
    geneModifier.init();
});

var geneModifier = {
    init: function() {
		var self = this;
		this.populateLogs();
        this.populateGenes();
        this.populateModifiedGenes();
        this.populateChangeSets();
        this.populateChromosomes();
	},
    populateLogs: function(callback) {
        $.getJSON("/json/logs", function(data) {
			$("#logList").empty();
            $(data).each(function(index, element) {
                $("<li />", {
                    id: element, 
                    html: "<a>" + element + "</a>"
                }).appendTo($("#logList"));
            });
        });
    },
    populateGenes: function() {
        $.getJSON("/json/genes", function(data) {
			$("#geneList").empty();
			$("#selectGene").empty();
            $(data).each(function(index, element) {
                $("<li />", {
                    id: element, 
                    html: "<a>" + element + "</a>"
                }).appendTo($("#geneList"));    
                $("<option />", {
                    value: element, 
                    text: element
                }).appendTo($("#selectGene"));    
            });
            $("#selectGene").selectmenu("refresh");
        });
    },
    populateModifiedGenes: function() {
        $.getJSON("/json/genes/modified", function(data) {
			$("#modifiedGeneList").empty();
            $(data).each(function(index, element) {
                $("<li />", {
                    id: element, 
                    html: "<a>" + element + "</a>"
                }).appendTo($("#modifiedGeneList"));    
            });
        });
    },
    populateChangeSets: function() {
        $.getJSON("/json/changesets", function(data) {
			$("#changeSetList").empty();
            $(data).each(function(index, element) {
                $("<li />", {
                    id: element, 
                    html: "<a>" + element + "</a>"
                }).appendTo($("#changeSetList"));    
                $("<option />", {
                    value: element, 
                    text: element
                }).appendTo($("#selectChangeset"));    
            });
            $("#selectChangeset").selectmenu("refresh");
        });
    },
    populateChromosomes: function() {
		$.getJSON("/json/chromosomes", function(data) {
			$("#chromosomeList").empty();
			$(data).each(function(index, element) {
				$("<li />", {
					id: element, 
                    html: "<a>" + element + "</a>"
				}).appendTo($("#chromosomeList"));    
			});
		});
	}
}