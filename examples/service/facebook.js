var rem = require('../../rem');

// Create Dropbox API, prompting for key/secret.
var fb = rem.load('facebook', 1.0).prompt();

// Authenticate user via the console.
rem.console(fb, {
  scope: ["email", "publish_stream", "read_stream", "user_photos"]
}, function (err, user) {

  // Read our profile.
  user('me').get(function(err, json) {
    console.log('Your profile: (error', err, ')');
    console.log(json);

    // Get your latest image.
    user('me/photos').get(function(err, json) {
      rem.url(json.data[0].source).head(function(err, _, res) {
        console.log('Your latest image: (error', err, ')');
        console.log(res.headers);
      });
    });
  });
});