var rem = require('../..');

// Create Dropbox API, prompting for key/secret.
var fb = rem.load('facebook', 1.0).prompt();

// Authenticate user via the console.
rem.console(fb, {
  scope: ["user_photos"]
}, function (err, user) {

  // Read our profile.
  user('me').get(function(err, json) {
    console.log('Your profile: (error', err, ')');
    console.log(json);

    // Get your latest image.
    user('me/photos').get(function(err, json) {
      rem.url(json.data[0].source).head(function(err, res) {
        console.log('Your latest image: (error', err, ')');
        console.log(res.headers);
      });
    });
  });
});