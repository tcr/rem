var rem = require('../..');

// Create Facebook API, prompting for key/secret.
// Authenticate user via the console.
rem.connect('instagram.com', 1.0).prompt({
  scope: ["basic", "comments", "relationships", "likes"]
}, function (err, user) {

  // Read our profile.
  user('users/self/feed').get(function (err, json) {
    console.log('Your feed: (error', err, ')');
    console.log(json.data[0]);
  });
});