var http = require('http');

opengraphParser = function() {
  this.defaultOptions = function(){return {hostname: 'www.opengraph.io', path: '/api/1.0/site/'}}; 
  this.ogHybridParse = function(JSONPdata) {
    jsonData = JSON.parse(JSONPdata);
    return(jsonData.hybridGraph);
  };
};

opengraphParser.prototype.getHybridGraph = function(url, callback) {
  var options = new this.defaultOptions();
  var ogHybridParse = this.ogHybridParse;
  options.path = options.path + encodeURIComponent(url);
  var req = http.get(options, function(res) {
    var JSONPdata = "";
    res.on('data', function(chunk) {
      JSONPdata = JSONPdata + chunk;
    }).on('end', function() {
      hybridGraph = ogHybridParse(JSONPdata);
      if(hybridGraph) {callback(null, hybridGraph);}
      else {callback("Unable to get HybridGraph data", null);}
    });
  });
  
  req.on('error', function(e) {
    callback("Unable to get HybridGraph data", null);
  });
};

exports.opengraphParser = opengraphParser;