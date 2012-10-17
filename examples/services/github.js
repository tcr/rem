var rem = require('../..');

// Create Github API, prompting for key/secret.
var gh = rem.load('github', 3.0).prompt();

// Authenticate user via the console.
rem.console(gh, {
  scope: ["user", "repo"]
}, function (err, user) {

  // List user gists.
  user('user').get(function (err, profile) {
    user("users", profile.login, "gists").get(function (err, json) {
      console.log('Your gists:');
      json.forEach(function (gist) {
        console.log(' -', gist.description)
      });
    });
  });
});