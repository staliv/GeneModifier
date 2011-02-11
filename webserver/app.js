
/**
 * Module dependencies.
 */
var fs = require("fs");

//var log4js = require("log4js")();
//log4js.configure("./../logs/config.json");

var express = require('express');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyDecoder());
  app.use(express.methodOverride());
  app.use(express.cookieDecoder());
  app.use(express.session({secret: "KS5Z_bv^%38hS#028_2[n"}));
  app.use(app.router);
  app.use(express.staticProvider(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
    locals: {
      title: 'Gene Modifier'
    }
  });
});

app.get('/json/logs', function(request, response) {
    response.contentType('application/json');
    
    fs.readdir("../logs/", function(error, logFiles) {
        if (error) return error;

        //Exclude config.json
        logFiles.splice(logFiles.indexOf("config.json"), 1);
        logFiles.splice(logFiles.indexOf(".DS_Store"), 1);
        
        response.send(JSON.stringify(logFiles));
    });
});

app.get('/json/genes', function(request, response) {
    response.contentType('application/json');
    
    fs.readdir("../genes/", function(error, geneFiles) {
        if (error) return error;

        //Exclude README
        geneFiles.splice(geneFiles.indexOf("README"), 1);

        geneFiles.splice(geneFiles.indexOf(".gitignore"), 1);
        geneFiles.splice(geneFiles.indexOf("modified"), 1);
        geneFiles.splice(geneFiles.indexOf(".DS_Store"), 1);
        
        response.send(JSON.stringify(geneFiles));
    });
});


app.get('/json/genes/modified', function(request, response) {
    response.contentType('application/json');
    
    fs.readdir("../genes/modified/", function(error, modifiedGeneFiles) {
        if (error) return error;

        //Exclude README
        modifiedGeneFiles.splice(modifiedGeneFiles.indexOf("README"), 1);
        modifiedGeneFiles.splice(modifiedGeneFiles.indexOf(".DS_Store"), 1);

        //Redistribute according to .fa - .offsets
        
        //modifiedGeneFiles.splice(logFiles.indexOf("config.json"), 1);
        
        response.send(JSON.stringify(modifiedGeneFiles));
    });
});

app.get('/json/changesets', function(request, response) {
    response.contentType('application/json');
    
    fs.readdir("../changesets/", function(error, changeSetFiles) {
        if (error) return error;

        //Exclude README and test directory
        changeSetFiles.splice(changeSetFiles.indexOf("README"), 1);
        changeSetFiles.splice(changeSetFiles.indexOf("test"), 1);
        changeSetFiles.splice(changeSetFiles.indexOf(".DS_Store"), 1);
        
        response.send(JSON.stringify(changeSetFiles));
    });
});

app.get('/json/chromosomes', function(request, response) {
    response.contentType('application/json');
    
    fs.readdir("../chromosomes/", function(error, chromosomeFiles) {
        if (error) return error;

        //Exclude README 
        chromosomeFiles.splice(chromosomeFiles.indexOf("README"), 1);
        chromosomeFiles.splice(chromosomeFiles.indexOf(".gitignore"), 1);
        chromosomeFiles.splice(chromosomeFiles.indexOf(".DS_Store"), 1);

        response.send(JSON.stringify(chromosomeFiles));
    });
});

// Only listen on $ node app.js

if (!module.parent) {
    app.listen(8080);
    console.log("Express server listening on port " + app.address().port)
}
