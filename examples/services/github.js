var rem = require('../..');
var read = require('read');

// Create Github API, prompting for key/secret.
// Authenticate user via the console.
rem.load('github.com', 3.0).prompt({
  scope: ["user", "repo", "gist"]
}, function (err, user) {

  // List user gists.
  user('user').get(function (err, profile) {
    user("users", profile.login, "gists").get(function (err, json) {
      console.log('Your gists:');
      json.forEach(function (gist) {
        console.log(' -', gist.description)
      });
      console.log('');

      read({ prompt: "Create a new (private) gist with the contents: "}, function (err, text) {
        if (!err) {
          user('gists').post({
            description: 'A Gist created with Rem. http://github.com/tcr/rem-js',
            public: true,
            files: {
              "rem.txt": {
                content: text
              }
            }
          }, function (err, json, res) {
            console.error(json);
          });
        } else {
          console.error('Skipping.');
        }
      })
    });
  });
});