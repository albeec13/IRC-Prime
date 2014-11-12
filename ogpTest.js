var opengraphParser = require('./opengraphParser.js').opengraphParser;

var ogParser = new opengraphParser();

url = "http://zer05595.files.wordpress.com/2013/09/koalifications.jpg";

ogParser.getHybridGraph(url, function(error, graph) {
  if(error) { console.log(error);}
  else {
    console.log(graph);
  }
});

url = "http://www.slate.com/articles/video/video/2014/11/see_the_startling_growth_of_chickens_from_1957_to_1978_to_2005.html";

ogParser.getHybridGraph(url, function(error, graph) {
  if(error) { console.log(error);}
  else {
    console.log(graph);
  }
});