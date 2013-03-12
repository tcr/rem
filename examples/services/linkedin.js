var rem = require('../..');

// Create Facebook API, prompting for key/secret.
// Authenticate user via the console.
rem.connect('linkedin.com', 1.0).prompt(function (err, user) {
  user.debug = true;

  // Read our profile.
  user('people/~').get(function (err, json) {
    console.log(err, json);
  });
});