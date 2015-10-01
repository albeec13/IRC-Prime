var Db = require('mongodb').Db
  , Connection = require('mongodb').Connection
  , Server = require('mongodb').Server
  , BSON = require('mongodb').BSON
  , ObjectID = require('mongodb').ObjectID
  , moment = require('moment-timezone');

ircDataProvider = function(host, port, dbName, callback){
  this.db = new Db(dbName, new Server(host, port, {auto_reconnect: true}, {}), {w: 1});
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
  this.getCollection(function(error, collection) {
    if(error) callback(error);
    else {
      if(criteria === undefined || criteria === null) {
        criteria = {};
      }
      if(limit === undefined || limit === null || isNaN(limit)) {
        limit = 0;
      }
      collection.find(criteria, function(error, cursor) {
        if(error) callback(error);
        else {
          cursor.limit(limit).sort({"_id":-1}).toArray(function(error, data) {
            if(error) callback(error);
            else callback(null, data);
          });
        }
      });      
    }
  }, collectionName);
};

ircDataProvider.prototype.delete = function(callback, collectionName, id) {
  this.getCollection(function(error, collection) {
    if(error) callback(error);
    else {
      collection.remove({"_id" : new ObjectID(id)}, function(error, nRemoved) {
        if(error) callback(error);
        else callback(null, nRemoved);
      });
    }
  }, collectionName);
};

ircDataProvider.prototype.update = function(callback, collectionName, criteria, updateData, options) {
  this.getCollection(function(error, collection) {
    if(error) callback(error);
    else {
      collection.update(criteria, updateData, options, callback);
    }
  }, collectionName);
};

ircDataProvider.prototype.insert = function(callback, collectionName, insertData) {
  this.getCollection(function(error, collection) {
    if(error) callback(error);
    else {
      collection.insert(insertData, callback);
    }
  }, collectionName);
};

exports.ircDataProvider = ircDataProvider;

