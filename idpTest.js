var ircDataProvider = require('./ircDataProvider').ircDataProvider;

var ready = function (err) {
  if(err) console.log("oops");
  else {
    idp.delete(function(err, result){
      console.log("delete callback:");
      console.log(err);
      console.log(result);
    }, 'links', "5481eed7719441354fee4d68");
  };
};

var idp = new ircDataProvider('localhost', 27017, 'laticus', ready);


