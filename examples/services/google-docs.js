var rem = require('rem');

// make sure that when you make your app in the APIs console,
// the Client ID must be application type "Installed Application"
// then use the client ID and client secret

// Create Google Document API, prompting for key/secret.
// Authenticate user via the console.
rem.connect('docs.google.com', 3.0).prompt(function (err, user) {
  user('files').get(function(err, json) {
    if (err) { console.log(err); return; }
    // print out the documents
    json.items.forEach(function(item) {
      if (item.mimeType.indexOf('document') != -1) {
        console.log('Document:', item.title);
      }
    });
  });
});