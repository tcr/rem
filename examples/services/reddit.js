var rem = require('../..');
var read = require('read');

rem.connect('reddit.com', 1.0).prompt(function (err, user) {
  if (err) { return console.error(err); }

  user('api/me').get(function (err, json) {
    if (err) { return console.error(err); }
    console.log('Your account:', JSON.stringify(json, null, '  '));
  });
});