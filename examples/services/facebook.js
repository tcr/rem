var rem = require('../..');

// Create Dropbox API, prompting for key/secret.
// Authenticate user via the console.
rem.connect('facebook.com', 1.0).prompt({
  scope: ["user_photos"]
}, function (err, user) {

  // Read our profile.
  user('me').get(function(err, json) {
    console.log('Your profile: (error', err, ')');
    console.log(json);

    // Get your latest image.
    user('me/photos').get(function(err, json) {
      (new rem.Client()).stream(json.data[0].source).head(function(err, stream, res) {
        console.log('Your latest image: (error', err, ')');
        console.log(res.headers);
      });
    });
  });
});