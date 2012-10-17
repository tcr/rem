var rem = require('../..');

// Create Dropbox API, prompting for key/secret.
var dbox = rem.load('dropbox', 1.0).prompt();

// Authenticate user via the console.
rem.console(dbox, function (err, user) {

  // Create a file.
  user('files_put/sandbox/REM.txt').put(
    'text/plain',
    'REM is hiding in your dropcube'
  , function(err, json) {
    console.log('PUT file: (error', err, ')');
    console.log(json);
  });
  
  // List sandbox contents.
  user('metadata/sandbox/').get(function (err, json) {
    console.log('Sandbox contents: (error', err, ')');
    if (json) {
      json.contents.forEach(function (file) {
        console.log(' -', file.path);
      });
    }
  });
});