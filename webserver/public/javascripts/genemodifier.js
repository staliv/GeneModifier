$(document).ready(function() {
    geneModifier.init();
});

var geneModifier = {
    init: function() {
        this.initLogs();
        this.initModifiedGenes();
        this.initChangeSets();
        this.initChromosomes();
},
    initLogs: function() {
        $.getJSON("/json/logs", function(data) {
            $(data).each(function(index, element) {
                $("<div />", {
                    id: element, 
                    text: element
                }).appendTo($("#logs"));    
            });
        });
    },
    initModifiedGenes: function() {
        $.getJSON("/json/genes/modified", function(data) {
            $(data).each(function(index, element) {
                $("<div />", {
                    id: element, 
                    text: element
                }).appendTo($("#modifiedGenes"));    
            });
        });
    },
    initChangeSets: function() {
        $.getJSON("/json/changesets", function(data) {
            $(data).each(function(index, element) {
                $("<div />", {
                    id: element, 
                    text: element
                }).appendTo($("#changeSets"));    
            });
        });
    },
    initChromosomes: function() {
    $.getJSON("/json/chromosomes", function(data) {
        $(data).each(function(index, element) {
            $("<div />", {
                id: element, 
                text: element
            }).appendTo($("#chromosomes"));    
        });
    });
}


}