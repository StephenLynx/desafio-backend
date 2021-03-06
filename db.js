'use strict';

// Copied from my other project, LynxChan

var mongo = require('mongodb');

var indexesSet;

var cachedDb;
var cachedClient;

var maxIndexesSet = 2;

var cachedUsers;
var cachedLedger;

var loading;

function indexSet(callback) {

  indexesSet++;

  if (indexesSet === maxIndexesSet) {
    loading = false;
    callback();
  }

}

function initUsers(callback) {

  cachedUsers.createIndexes([ {
    key : {
      identifier : 1
    },
    unique : true
  }, {
    key : {
      email : 1
    },
    unique : true
  } ], function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });

}

function initLedger(callback) {

  cachedLedger.createIndexes([ {
    key : {
      target : 1
    },
  } ], function setIndex(error, index) {
    if (error) {
      if (loading) {
        loading = false;

        callback(error);
      }
    } else {
      indexSet(callback);
    }
  });

}

exports.client = function() {
  return cachedClient;
};

exports.users = function() {
  return cachedUsers;
};

exports.ledger = function() {
  return cachedLedger;
};

function initCollections(callback) {

  cachedUsers = cachedDb.collection('users');
  cachedLedger = cachedDb.collection('ledger');

  initUsers(callback);
  initLedger(callback);

}

function connect(connectString, dbToUse, callback, attempts) {

  attempts = attempts || 0;

  mongo.MongoClient.connect(connectString, {
    useNewUrlParser : true,
    useUnifiedTopology : true
  }, function connectedDb(error, client) {

    if (error) {

      if (attempts > 9) {
        callback(error);
      } else {

        console.log(error);
        console.log('Retrying in 10 seconds');

        setTimeout(function() {
          connect(connectString, dbToUse, callback, ++attempts);
        }, 10000);
      }

    } else {

      cachedClient = client;
      cachedDb = client.db(dbToUse);

      initCollections(callback);
    }

  });

}

exports.init = function(callback) {

  if (loading) {
    callback('Already booting db');
  }

  loading = true;

  indexesSet = 0;

  var dbSettings = {
    address : 'mongodb',
    port : 27017,
    db : 'wallets'
  };

  var connectString = 'mongodb://';

  connectString += dbSettings.address + ':';
  connectString += dbSettings.port + '/' + dbSettings.db;

  connect(connectString, dbSettings.db, callback);

};
