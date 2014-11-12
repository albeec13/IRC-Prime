var ircDataProvider = require('./ircDataProvider').ircDataProvider;

var ready = function (err) {
  if(err) console.log("oops");
  else {
    idp.findAll(function(error, data) {
      console.log(error);
      console.log(data);
    }, 'activity')
  };
};

var idp = new ircDataProvider('localhost', 27017, 'testing', ready);


