var rem = require('../..');

// Create Github API, prompting for key/secret.
// Authenticate user via the console.
rem.load('github.com', 3.0).prompt({
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