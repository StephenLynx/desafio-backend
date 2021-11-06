'use strict';

var crypto = require('crypto');

var db = require('./db');
var miscOps = require('./miscOps');
var users = db.users();

var iterations = 16384;
var keyLength = 256;
var hashDigest = 'sha512';

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

// Obs: this should be under a captcha to prevent abuse, specially since the
// password is being hashed before trying to insert on the database.
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
