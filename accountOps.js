'use strict';

var crypto = require('crypto');

var db = require('./db');
var miscOps = require('./miscOps');

exports.createAccount = function(req, res) {

  var parameters = miscOps.fetchRequestParameters(req, [ {
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
  } ]);

  res.send(JSON.stringify(parameters, null, 2));

};
