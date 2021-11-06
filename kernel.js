#!/usr/bin/env node
'use strict';

var db = require('./db');
var accountOps;

var express = require('express');
var app = express();
app.use(express.json());
var port = 80;

db.init(function(error) {

  accountOps = require('./accountOps');

  if (error) {
    return console.log(error);
  }

  app.get('/', function(req, res) {
    res.send('Hello World!');
  });

  app.put('/account', accountOps.createAccount);

  app.listen(port, function() {
    console.log('Example app listening at http://localhost:' + port);
  });

});
