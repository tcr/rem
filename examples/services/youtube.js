var rem = require('../..');
var read = require('read');

// Create Youtube API, prompting for key/secret.
var yt = rem.connect('youtube.com', 2.0, {format: 'xml'}).prompt();

// Authenticate user via the console.
rem.console(yt, function (err, user) {

  // Get the currently logged in user.
  user('users/default').get(function (err, xml) {
    if (err) { console.error(err); return; }

    // Display your profile information.
    console.log('Your profile: (error', err, ')');
    var NS = {a: "http://www.w3.org/2005/Atom"};
    xml.find('/a:entry/*', NS).forEach(function (prop) {
      if (prop.text()) {
        console.log(' -', prop.name() + ':', prop.text())
      }
    })
  });
});
