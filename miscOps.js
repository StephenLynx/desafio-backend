'use strict';

var htmlReplaceTable = {
  '<' : '&lt;',
  '>' : '&gt;',
  '\"' : '&quot;',
  '\'' : '&apos;',
  '\u202E' : ''
};

// HTML sanitization copied from my other project, LynxChan
var htmlReplaceRegex = new RegExp(/[\u202E<>'"]/g);

exports.cleanHTML = function(string) {

  return string.replace(htmlReplaceRegex, function(match) {
    return htmlReplaceTable[match];
  });

};

// This part was copied and made more readable from stack overflow which in turn
// got it from email-validator, I didn't want to add a dependency only to
// validate e-mails.
var emailRegex = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

exports.isEmailValid = function(email) {

  if (!email) {
    return false;
  }

  if (email.length > 254) {
    return false;
  }

  var valid = emailRegex.test(email);
  if (!valid) {
    return false;
  }

  // Further checking of some things regex can't handle
  var parts = email.split('@');
  if (parts[0].length > 64) {
    return false;
  }

  var domainParts = parts[1].split('.');
  if (domainParts.some(function(part) {
    return part.length > 63;
  })) {
    return false;
  }

  return true;
};

exports.fetchRequestParameters = function(req, parameters) {

  var builtParameters = {};
  var sentParameters = req.body;

  for (var i = 0; i < parameters.length; i++) {

    var entry = parameters[i];

    if (!sentParameters[entry.field]) {
      continue;
    }

    switch (entry.type) {

    case 'string':
      if (typeof sentParameters[entry.field] !== 'string') {
        continue;
      }

      builtParameters[entry.field] = exports
          .cleanHTML(sentParameters[entry.field]);

      break;

    case 'email':

      if (typeof sentParameters[entry.field] !== 'string') {
        continue;
      }

      if (exports.isEmailValid(sentParameters[entry.field])) {
        builtParameters[entry.field] = sentParameters[entry.field];
      }

      break;

    case 'boolean':
      builtParameters[entry.field] = !!sentParameters[entry.field];

      break;

    case 'money':

      if (typeof sentParameters[entry.field] !== 'number') {
        continue;
      }

      if ((sentParameters[entry.field] % 1) !== 0) {

        if (sentParameters[entry.field].toString().split('.')[1].length > 2) {
          continue;
        }

      }
      
      builtParameters[entry.field] = sentParameters[entry.field];

      break;

    }

  }

  return builtParameters;

};

exports.returnError = function(res, error) {

  if(typeof error !== 'string') {
    console.trace(error);
    error = 'Sistema indisponível, tente novamente mais tarde.';
  }

  exports.returnResponse(res, {
    status : 'error',
    error : error
  });

};

exports.returnResponse = function(res, data) {

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data));

};
