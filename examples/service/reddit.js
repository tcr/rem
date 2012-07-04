var rem = require('../../rem');
var read = require('read');

var reddit = rem.load('reddit', '1');
var session = rem.session(reddit);
read({prompt: 'Username: '}, function (err, user) {
  read({prompt: 'Password: ', silent: true}, function (err, password) {
    session.authenticate(user, password, example);
  });
});

example = function (err, user) {
  if (err) { console.log(err); return; }
  user('api/me').get(function (err, json) {
    if (err) { console.log(err); return; }
    console.log('Your account:', JSON.stringify(json, null, '  '));
  });
};