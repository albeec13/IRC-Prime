var express = require('express')
  , cors = require('cors')
  , app = express()
  , jsonBody = require('body-parser').json()
  , crypto = require('crypto')
  , irc = require('irc')
  , ircDataProvider = require('./ircDataProvider').ircDataProvider
  , opengraphParser = require('./opengraphParser.js').opengraphParser;

/* PREPARE OPENGRAPH DATA PARSER AND HELPERS*/
var ogParser = new opengraphParser();

var getOGPmongoUpdate = function(url, callback) {
  var ret = {};
  ogParser.getHybridGraph(url, function(error, graph) {
    if(error) {callback(error, ret);}
    else {
      ret.title = graph.title;
      ret.description = graph.description;
      ret.image = graph.image;
      callback(null, ret);
    }
  });
};

/* CORS ROUTING CONFIGURATION */
var whitelist = ['http://thecact.us', 'https://thecact.us', 'http://thewalr.us', 'http://www.thecact.us', 'https://www.thecact.us', 'http://www.thewalr.us'];

var corsOptions = {
  origin: function(origin, callback){
    var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
    callback(null, originIsWhitelisted);
  },
  maxAge: 1728000,
  exposedHeaders: 'Location',
  methods: 'GET,POST,OPTIONS',
  allowedHeaders: 'Authorization,Content-Type,Accept,Origin,User-Agent,DNT,Cache-Control,X-Mx-ReqToken,Keep-Alive,X-Requested-With,If-Modified-Since'
};

/* MONGODB IRCDATAPROVIDER CONNECTION AND HELPERS */
var dbReady = false;
var ready = function(error) {
  if(error) console.log(error);
  else dbReady = true;
}
var ircData = new ircDataProvider('localhost', 27017,'laticus',ready);

var genericUserUpdate = function(nick, mongoUpdate) {
  if(dbReady) {
    ircData.getCollection(function (error, collection) {
      if(error) console.log(error);
      else {
        collection.update({"user": nick},mongoUpdate,{"upsert" : true}, function(error, modified, result) {
          if(error) console.log(error);
        });
      }
    }, 'users');
  }
};

var genericLinkUpdate = function(linkURL, nick, mongoUpdate) {
  if(dbReady) {
    ircData.getCollection(function (error, collection) {
      if(error) console.log(error);
      else {
        collection.update({"url": linkURL, "user": nick},mongoUpdate,{"upsert" : true}, function(error, modified, result) {
          if(error) console.log(error);
        });
      }
    }, 'links');
  }
};

var genericActivityUpdate = function(mongoUpdate) {
  if(dbReady) {
    ircData.getCollection(function (error, collection) {
      if(error) console.log(error);
      else {
        collection.insert(mongoUpdate, function(error, modified, result) {
          if(error) console.log(error);
        });
      }
    }, 'activity');
  }
};

var genericTubeUpdate = function(tubeID, nick, mongoUpdate) {
  if(dbReady) {
    ircData.getCollection(function (error, collection) {
      if(error) console.log(error);
      else {
        var criteria = {};
        if(nick == "BetterBot") {
          criteria = {"id": tubeID};
        }
        else {
          criteria = {"id": tubeID, "user": nick};
        }
        collection.update(criteria,mongoUpdate,{"upsert" : true}, function(error, modified, result) {
          if(error) console.log(error);
        });
      }
    }, 'tubes');
  }
};

/* YOUTUBE LINK PARSER */
var youtubeLink = function(url) {
  var regExp = /^.*(?:(?:youtu\.be\/([^#\&\?]*))|(?:youtube.com\/(?:v\/|.*\/u\/\w\/|embed\/|watch\??v?=?)([^#\&\?]*))).*$/;
  var match = url.match(regExp);
  if (match) {
    if(match[1]) {
      return {"result" : true, "id" : match[1]};
    }
    else if(match[2]) {
      return {"result" : true, "id" : match[2]};
    }
    else {
      return {"result" : false, "id" : null};
    }
  }
  else {
    return {"result" : false, "id" : null};
  }
}

/* IRC CLIENT CONNECTION AND LISTENERS */
var client = new irc.Client('morgan.freenode.net', 'Laticus-Prime', {channels: ['#laticus'], retryCount: 5000, retryDelay: 30000});

client.addListener('message#laticus', function (from, message) {
  var usersUpdate = {"$inc" : {"posts" : 1, "links" : 0}, "$setOnInsert" : {"lastLogin" : "unknown", "online" : true}};
  var linksUpdate = {"$setOnInsert" : {}};
  var tubesUpdate = {"$setOnInsert" : {}};
  
  URLlist = message.match(/http[s]?:\/\/[\S]*/ig);
  if(URLlist != null) {
    for (var i = 0; i < URLlist.length; i++) {
      var tube = youtubeLink(URLlist[i]);
      if(tube.result) {
        tubesUpdate.$setOnInsert.user = from;
        tubesUpdate.$setOnInsert.id = tube.id;
        tubesUpdate.$setOnInsert.time = new Date().toISOString();
        usersUpdate.$inc.links = usersUpdate.$inc.links + 1;
        
        genericTubeUpdate(tube.id, from, tubesUpdate);
      }
      else {
        linksUpdate.$setOnInsert.user = from;
        linksUpdate.$setOnInsert.url = URLlist[i];
        linksUpdate.$setOnInsert.time = new Date().toISOString();
        usersUpdate.$inc.links = usersUpdate.$inc.links + 1;
        
        getOGPmongoUpdate(linksUpdate.$setOnInsert.url, function(error, update) {
          if(error) {console.log(error);}          
          linksUpdate.$setOnInsert.og = update;
          genericLinkUpdate(linksUpdate.$setOnInsert.url, from, linksUpdate);
        });
      }        
    }
  }  
  genericUserUpdate(from, usersUpdate);
});

client.addListener('names#laticus', function(nicks) {
  if(dbReady) {
    ircData.find(function(error, dbOnline) {
      var dbOffline = {};
      for(var i = 0; i < dbOnline.length; i++) {
        if(nicks.hasOwnProperty(dbOnline[i].user)) {
          delete nicks[dbOnline[i].user];
        }
        else {
          dbOffline[dbOnline[i].user] = "";
        }
      }
      var usersUpdate = {"$set" : {"online" : true}, "$setOnInsert" : {"posts" : 0, "links" : 0, "lastLogin" : "unknown"}};
      for(var nick in nicks) {
        if(!nicks.hasOwnProperty(nick)) { continue; }
        genericUserUpdate(nick, usersUpdate);
      }
      usersUpdate = {"$set" : {"online" : false}, "$setOnInsert" : {"posts" : 0, "links" : 0, "lastLogin" : "unknown"}};
      for(var nick in dbOffline) {
        if(!dbOffline.hasOwnProperty(nick)) { continue; }
        genericUserUpdate(nick, usersUpdate);
      }
    },'users', {"online" : true});
  }
});

client.addListener('join#laticus', function(nick) {
  var timeStamp = new Date().toISOString();
  var usersUpdate = {"$set" : {"online" : true, "lastLogin" : timeStamp}, "$setOnInsert" : {"posts" : 0, "links" : 0}};
  var activityUpdate = {"user" : nick, "event" : "joined", "time" : timeStamp};
  genericUserUpdate(nick, usersUpdate);
  genericActivityUpdate(activityUpdate);
});

client.addListener('part#laticus', function(nick, reason) {
  var timeStamp = new Date().toISOString();
  var usersUpdate = {"$set" : {"online" : false}, "$setOnInsert" : {"posts" : 0, "links" : 0, "lastLogin" : "unknown"}};
  var activityUpdate = {"user" : nick, "event" : "parted", "reason" : reason, "time" : timeStamp};
  genericUserUpdate(nick, usersUpdate);
  genericActivityUpdate(activityUpdate);
});

client.addListener('kick#laticus', function(nick, by, reason) {
  var timeStamp = new Date().toISOString();
  var usersUpdate = {"$set" : {"online" : false}, "$setOnInsert" : {"posts" : 0, "links" : 0, "lastLogin" : "unknown"}};
  var activityUpdate = {"user" : nick, "event" : "kicked", "by" : by, "reason" : reason, "time" : timeStamp};
  genericUserUpdate(nick, usersUpdate);
  genericActivityUpdate(activityUpdate);
});

client.addListener('quit', function(nick, reason) {
  var timeStamp = new Date().toISOString();
  var usersUpdate = {"$set" : {"online" : false}, "$setOnInsert" : {"posts" : 0, "links" : 0, "lastLogin" : "unknown"}};
  var activityUpdate = {"user" : nick, "event" : "quit", "reason" : reason, "time" : timeStamp};
  genericUserUpdate(nick, usersUpdate);
  genericActivityUpdate(activityUpdate);
});

client.addListener('kill', function(nick, reason) {
  var timeStamp = new Date().toISOString();
  var usersUpdate = {"$set" : {"online" : false}, "$setOnInsert" : {"posts" : 0, "links" : 0, "lastLogin" : "unknown"}};
  var activityUpdate = {"user" : nick, "event" : "killed", "reason" : reason, "time" : timeStamp};
  genericUserUpdate(nick, usersUpdate);
  genericActivityUpdate(activityUpdate);
});

client.addListener('nick', function(oldnick, newnick) {
  var timeStamp = new Date().toISOString();
  var usersUpdate = {"$set" : {"online" : false}, "$setOnInsert" : {"posts" : 0, "links" : 0, "lastLogin" : "unknown"}};
  var activityUpdate = {"user" : oldnick, "event" : "nick", "oldnick" : oldnick, "newnick" : newnick, "time" : timeStamp};
  genericUserUpdate(oldnick, usersUpdate);
  genericActivityUpdate(activityUpdate);
  
  usersUpdate = {"$set" : {"online" : true, "lastLogin" : timeStamp}, "$setOnInsert" : {"posts" : 0, "links" : 0}};
  genericUserUpdate(newnick, usersUpdate);
});

client.addListener('error', function(message) {
    console.log('error: ', message);
});

/* EXPRESS CONFIG AND SERVER ENDPOINTS FOR RETURNING JSON DATA */
app.use(jsonBody);

app.options('/auth/',cors(corsOptions));

app.get('/users/:start_ID/:limit/', cors(corsOptions), function(req, res, next){
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  if(dbReady) {
    var criteria = {};
    var limit = parseInt(req.params.limit);
    ircData.find(function(error, data) {
      res.json(data);
    },'users',criteria,limit);
  }
});

app.get('/links/', cors(corsOptions), function(req, res, next){
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  if(dbReady) {
    ircData.find(function(error, data) {
      res.json(data);
    },'links');
  }
});

app.get('/activity/', cors(corsOptions), function(req, res, next){
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  if(dbReady) {
    ircData.find(function(error, data) {
      res.json(data);
    },'activity');
  }
});

app.get('/tubes/', cors(corsOptions), function(req, res, next){
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  if(dbReady) {
    ircData.find(function(error, data) {
      res.json(data);
    },'tubes');
  }
});

app.post('/auth/', cors(corsOptions), function(req, res, next){
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  if(dbReady) {
    var user = req.body.user, pass = req.body.pass;
    console.log(user + ":" + pass);
    crypto.randomBytes(48, function(ex, buf) {
      res.json({token: buf.toString('base64')});
    });
  }
});
  
/* START SERVER */
app.listen(26969);
