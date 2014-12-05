var Db = require('mongodb').Db
  , Connection = require('mongodb').Connection
  , Server = require('mongodb').Server
  , BSON = require('mongodb').BSON
  , ObjectID = require('mongodb').ObjectID
  , moment = require('moment-timezone');

ircDataProvider = function(host, port, dbName, callback){
  this.db = new Db(dbName, new Server(host, port, {auto_reconnect: true}, {}));
  this.db.open(function(error, db) {
    if(error) callback(error);
    else callback(null);
  });
};

ircDataProvider.prototype.getCollection = function(callback, collectionName) {
  this.db.collection(collectionName, function(error, collectionData) {
    if(error) callback(error);
    else callback(null, collectionData);
  });
};

ircDataProvider.prototype.find = function(callback, collectionName, criteria, limit) {
  this.getCollection(function(error, ircDataCollection) {
    if(error) callback(error);
    else {
      if(criteria === undefined || criteria === null) {
        criteria = {};
      }
      if(limit === undefined || limit === null || isNaN(limit)) {
        limit = 0;
      }
      ircDataCollection.find(criteria).limit(limit).sort({"_id":-1}).toArray(function(error, data) {
        if(error) callback(error);
        else callback(null, data);
      });
    }
  }, collectionName);
};

exports.ircDataProvider = ircDataProvider;

