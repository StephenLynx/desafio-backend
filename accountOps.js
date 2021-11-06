'use strict';

var crypto = require('crypto');
var https = require('https');
var mongo = require('mongodb');
var db = require('./db');
var miscOps = require('./miscOps');
var users = db.users();
var ledger = db.ledger();
var ObjectID = mongo.ObjectId;
var iterations = 16384;
var keyLength = 256;
var hashDigest = 'sha512';
var confirmationAddress = 'https://run.mocky.io/v3/1f1b822a-3d6f-4b95-9a01-b3e6191e436b';

var creationParameters = [ {
  field : 'name',
  type : 'string'
}, {
  field : 'password',
  type : 'string'
}, {
  field : 'email',
  type : 'email'
}, {
  field : 'identifier',
  type : 'string'
}, {
  field : 'retailer',
  type : 'boolean'
} ];

var loginParameters = [ {
  field : 'login',
  type : 'string'
}, {
  field : 'password',
  type : 'string'
} ];

var transferParameters = [ {
  field : 'id',
  type : 'string'
}, {
  field : 'destination',
  type : 'string'
}, {
  field : 'value',
  type : 'money'
}, {
  field : 'session',
  type : 'string'
} ];

exports.sanitizeIdentifier = function(parameters) {

  if (!parameters.identifier) {
    return;
  }

  var identifier = parameters.identifier.replace(/[^0-9]/g, '');

  if (identifier.length !== (parameters.retailer ? 14 : 11)) {
    return;
  }

  return identifier;
};

// Obs: this should be under a captcha to prevent abuse, specially since the
// password is being hashed before trying to insert on the database.
// Section 1: Account creation {
exports.createAccount = function(req, res) {

  var parameters = miscOps.fetchRequestParameters(req, creationParameters);

  if (!parameters.name) {
    return miscOps.returnError(res, 'Nome inválido.');
  } else if (!parameters.email) {
    return miscOps.returnError(res, 'E-mail inválido.');
  } else if (!parameters.password) {
    return miscOps.returnError(res, 'Senha inválida.');
  }

  var processedIdentifier = exports.sanitizeIdentifier(parameters);

  if (!processedIdentifier) {

    if (parameters.retailer) {
      return miscOps.returnError(res, 'CNPJ inválido.');
    } else {
      return miscOps.returnError(res, 'CPF inválido.');
    }

  }

  exports.getNewUserPassword(parameters.password, function(error, salt,
      password) {

    if (error) {
      miscOps.returnError(res, error);
    } else {
      exports.insertUser(parameters, salt, password, res, processedIdentifier);
    }

  });

};

// This was also copied from my other project, LynxChan
exports.getNewUserPassword = function(password, callback) {

  crypto.randomBytes(64, function gotSalt(error, buffer) {

    if (error) {
      return callback(error);
    }

    var salt = buffer.toString('base64');

    // style exception, too simple
    crypto.pbkdf2(password, salt, iterations, keyLength, hashDigest,
        function hashed(error, hash) {

          if (error) {
            return callback(error);
          }

          callback(null, salt, hash.toString('base64'));

        });
    // style exception, too simple

  });

};

exports.insertUser = function(parameters, salt, password, res,
    processedIdentifier) {

  users.insertOne({
    email : parameters.email,
    passwordSalt : salt,
    password : password,
    identifier : processedIdentifier,
    retailer : parameters.retailer,
    name : parameters.name
  }, function createdUser(error) {

    if (error && error.code !== 11000) {
      miscOps.returnError(res, error);
    } else if (error) {

      if (error.keyPattern.identifier) {

        if (parameters.retailer) {
          return miscOps.returnError(res, 'CNPJ em uso.');
        } else {
          return miscOps.returnError(res, 'CPF em uso.');
        }

      } else {
        miscOps.returnError(res, 'E-mail em uso.');
      }

    } else {

      miscOps.returnResponse(res, {
        status : 'ok'
      });

    }
  });

};
// } Section 1: Account creation

// Section 2: Login {
// This should be changed to allow concurrent logins from multiple devices.
// Having the sessions renew automatically every few minutes wouldn't be bad
// either.
exports.login = function(req, res) {

  var parameters = miscOps.fetchRequestParameters(req, loginParameters);

  if (!parameters.login) {
    return miscOps.returnError(res, 'Informe seu CPF, CNPJ ou e-mail.');
  } else if (!parameters.password) {
    return miscOps.returnError(res, 'Informe sua senha.');
  }

  var query = {};

  if (miscOps.isEmailValid(parameters.login)) {
    query.email = parameters.login;
  } else {
    query.identifier = parameters.login.replace(/[^0-9]/g, '');
  }

  users.findOne(query, function(error, user) {

    if (error) {
      miscOps.returnError(res, error);
    } else if (!user) {
      miscOps.returnError(res, 'Falha de login.');
    } else {
      exports.testPassword(user, parameters, res);
    }

  });

};

exports.testPassword = function(user, parameters, res) {

  crypto.pbkdf2(parameters.password, user.passwordSalt, iterations, keyLength,
      hashDigest, function hashed(error, hash) {

        if (error || !hash) {
          miscOps.returnError(res, error);
        } else if (user.password !== hash.toString('base64')) {
          miscOps.returnError(res, 'Falha de login.');
        } else {
          exports.startSession(user, res);
        }

      });

};

exports.startSession = function(user, res) {

  crypto.randomBytes(256, function gotHash(error, buffer) {

    if (error) {
      return miscOps.returnError(res, error);
    }

    var session = buffer.toString('base64');

    users.updateOne({
      _id : user._id
    }, {
      $set : {
        session : session
      }
    }, function(error) {

      if (error) {
        miscOps.returnError(res, error);
      } else {

        miscOps.returnResponse(res, {
          status : 'ok',
          session : session,
          id : user._id
        });

      }

    });

  });

};
// } Section 2: Login

// Section 3: Transfer {
exports.transfer = function(req, res) {

  var parameters = miscOps.fetchRequestParameters(req, transferParameters);

  exports.getUserAccountToTransfer(parameters, function(error, user) {

    if (error) {
      return miscOps.returnError(res, error);
    }

    exports.getUserAccountToReceive(parameters, function(error, receiver) {

      if (error) {
        miscOps.returnError(res, error);
      } else {
        exports.performTransfer(user, receiver, parameters.value, res);
      }

    });

  });

};

exports.getUserAccountToTransfer = function(parameters, callback) {

  if (!parameters.session) {
    callback('Falha de login.');
  } else if (!parameters.destination) {
    callback('Conta de destino não encontrada.');
  } else if (!parameters.value || parameters.value < 0) {
    callback('Valor inválido.');
  }

  var userId;

  try {
    userId = new ObjectID(parameters.id);
  } catch (error) {
    callback('Falha de login.');
  }

  users.findOne({
    _id : userId,
    session : parameters.session
  }, function(error, user) {

    if (error) {
      callback(error);
    } else if (!user) {
      callback('Falha de login.');
    } else if (user.retailer) {
      callback('Lojistas não podem transferir fundos.');
    } else if (parameters.destination === user.identifier) {
      callback('Você não pode transferir dinheiro para sí próprio.');
    } else {
      callback(null, user);
    }

  });

};

exports.getUserAccountToReceive = function(parameters, callback) {

  users.findOne({
    identifier : parameters.destination.replace(/[^0-9]/g, '')
  }, function(error, receiver) {

    if (error) {
      callback(error);
    } else if (!receiver) {
      callback('Conta de destino não encontrada.');
    } else {
      callback(null, receiver);
    }

  });

};

exports.performTransfer = function(user, receiver, value, res) {

  var time = new Date();

  ledger.bulkWrite([ {
    insertOne : {
      document : {
        target : user._id,
        value : -value,
        confirmed : false,
        date : time,
        pair : receiver._id
      }
    }
  }, {
    insertOne : {
      document : {
        target : receiver._id,
        value : value,
        confirmed : false,
        date : time,
        pair : user._id
      }
    }
  } ], function(error, result) {

    if (error) {
      miscOps.returnError(res, error);
    } else {

      var convertedIds = [];

      for ( var key in result.insertedIds) {
        convertedIds.push(result.insertedIds[key]);
      }

      exports.checkForIntegrity(user, convertedIds, res);
    }

  });

};

exports.checkForIntegrity = function(user, insertedIds, res) {

  ledger.aggregate([ {
    $match : {
      target : user._id
    }
  }, {
    $group : {
      _id : 0,
      balance : {
        $sum : '$value'
      }
    }
  } ]).toArray(function(error, results) {

    if (error) {
      miscOps.returnError(res, error);
    } else if (!results.length || results[0].balance < 0) {
      exports.revertTransaction(insertedIds, res);
    } else {
      exports.confirmTransaction(insertedIds, res);
    }

  });

};

exports.revertTransaction = function(insertedIds, res, baseError) {

  ledger.deleteMany({
    _id : {
      $in : insertedIds
    }
  }, function(error) {

    if (error) {
      // TODO escalate the issue.
      console.log('ERROR: failed to rollback transaction with ids '
          + JSON.stringify(convertedIds, null, 2));
      console.log(error);

      miscOps.returnError(res, error);

    } else {
      miscOps.returnError(res, baseError || 'Saldo insuficiente.');
    }

  });

};

exports.confirmTransaction = function(insertedIds, res) {

  var data = '';

  var req = https.request(confirmationAddress, function gotData(localRes) {

    // style exception, too simple
    localRes.on('data', function(chunk) {
      data += chunk;
    });

    localRes.on('end', function() {
      exports.parseAuthorizationCheck(data, insertedIds, res);
    });
    // style exception, too simple

  });

  req.once('error', function(error) {
    exports.revertTransaction(insertedIds, res, error);
  });

  req.end();

};

exports.parseAuthorizationCheck = function(data, insertedIds, res) {

  try {

    data = JSON.parse(data);

    if (data.status !== 'Autorizado') {
      return exports.revertTransaction(insertedIds, res, 'Transação negada.');
    }

    ledger.updateMany({
      _id : {
        $in : insertedIds
      }
    }, {
      $set : {
        confirmed : true
      }
    }, function(error) {

      if (error) {
        exports.revertTransaction(insertedIds, res, error);
      } else {
        miscOps.returnResponse(res, {
          status : 'ok'
        });
      }

    });

  } catch (error) {
    exports.revertTransaction(insertedIds, res, error);
  }

};

// } Section 3: Transfer
