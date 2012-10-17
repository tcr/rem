var rem = require('../..');

// Create Google Calendar API, prompting for key/secret.
var gdocs = rem.load('google-docs', 3.0, {
	format: 'xml'
}).prompt();

// Authenticate user via the console.
rem.console(gdocs, function (err, user) {
  user('default/private/full').get(function(err, xml) {
    if (err) { console.log(err); return; }

    // List your documents.
    var NS = {a: "http://www.w3.org/2005/Atom"};
    xml.find('/a:feed/a:entry/a:title', NS).forEach(function (title) {
      console.log('Document:', title.text());
    })
  });
});