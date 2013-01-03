var rem = require('../..');

// Create Facebook API, prompting for key/secret.
// Authenticate user via the console.
rem.connect('facebook.com', 1.0).prompt({
  scope: ["user_photos"]
}, function (err, user) {

  user.debug = true;

  // Read our profile.
  user('me').get(function (err, json) {
    console.log('Your profile: (error', err, ')');
    console.log(json);

    // Get your latest image.
    console.log('\nFetching your photo information...');
    user('me/photos', {limit: 1}).get(function (err, json) {
      rem.stream(json.data[0].source).head(function (err, stream, res) {
        console.log('Your latest image: (error', err, ')');
        console.log(res.headers);
      });
    });
  });
});