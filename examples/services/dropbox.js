var rem = require('../..');

// Create Dropbox API, prompting for key/secret.
// Authenticate user via the console.
rem.connect('dropbox.com', 1.0).prompt(function (err, user) {

  // Create a file.
  user('files_put/sandbox/rem.txt').put(
    'text/plain',
    'Rem wuz here ' + String(new Date())
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