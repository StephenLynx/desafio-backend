#!/usr/bin/env node
'use strict';

var db = require('./db');
var accountOps;

var express = require('express');
var app = express();
app.use(express.json());
var port = 80;

//This should be changed to use all CPU cores.
db.init(function(error) {

  accountOps = require('./accountOps');

  if (error) {
    return console.log(error);
  }

  app.put('/account', accountOps.createAccount);
  app.post('/login', accountOps.login);
  app.post('/transfer', accountOps.transfer);

  app.listen(port, function() {
    console.log('Wallets listening at http://localhost:' + port);
  });

});
