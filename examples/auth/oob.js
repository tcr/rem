// npm install rem read
var rem = require('rem')
  , fs = require('fs')
  , read = require('read');

var dbox = rem.connect('dropbox.com', '*')
  , oauth = rem.oauth(dbox);

function oobPinLogin () {
  oauth.start(function(url, token, secret) {
    console.log("Visit:", url);
    read({
      prompt: "Hit enter when finished... "
    }, function () {
      // We don't need to specify a verifier for oob requests.
      oauth.complete(token, secret, authorizedRequests);
    });
  });
}

function authorizedRequests (err, user) {
  if (err) return console.log(err);

  // Create a file.
  user('files_put/sandbox/rem.txt').put(
    'text/plain',
    'Rem wuz here ' + String(new Date())
  , function(err, json) {
    console.log('PUT file: (error', err, ')');
    console.log(json);
  });

  user('metadata/sandbox/').get(function(err, json) {
    console.log('Sandbox contents: (error', err, ')');
    json.contents.forEach(function (f) {
      console.log(' -', f.path);
    });
  });
};

// Prompt for API keys and begin login.
dbox.promptConfiguration(oobPinLogin)