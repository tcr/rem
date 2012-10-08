var rem = require('rem');
var fs = require('fs');
var read = require('read');

var dbox = rem.load('dropbox', 1.0).prompt();
var oauth = rem.oauth(dbox);

oauth.start(function(url, token, secret) {
  console.log("Visit:", url);
  return read({
    prompt: "Hit enter when finished..."
  }, function() {
    return oauth.complete(token, secret, authorized);
  });
});

function authorized (err, user) {
  if (err) {
    console.log(err);
    return;
  }

  user('files_put/sandbox/REM.txt').put('text/plain', 'REM is hiding in your dropcube', function(err, json) {
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