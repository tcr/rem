var rem = require('../../rem');

// Create our facebook console.
rem.myConsole('facebook', 1.0, {
  scope: ["email", "publish_stream", "read_stream"]
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