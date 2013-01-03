var rem = require('rem');
var fs = require('fs');
var read = require('read');

var dbox = rem.connect('dropbox.com', 1.0)
var oauth = rem.oauth(dbox);

dbox.promptConfiguration(function () {
  oauth.start(function(url, token, secret) {
    console.log("Visit:", url);
    return read({
      prompt: "Hit enter when finished..."
    }, function() {
      return oauth.complete(token, secret, authorized);
    });
  });
});

function authorized (err, user) {
  if (err) {
    console.log(err);
    return;
  }

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