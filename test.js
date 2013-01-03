var rem = require('./');
rem.connect('github.com').prompt(function (err, user) {
  user('user').get(function (err, profile) {
    console.log('Hello', profile.name);
  });
});
