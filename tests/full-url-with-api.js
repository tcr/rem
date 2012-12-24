var assert = require('assert');

var rem = require('..');

rem.connect('facebook.com', 1.0).prompt({
  scope: ["user_photos"]
}, function (err, user) {

  user('me/photos').get(function (err, json) {
    console.log(json.data[0].source);
    user.stream(json.data[0].source).head(function (err, stream, res) {
      console.log('Fetch image URL:', res.url);
      console.log('Error:', err);
      assert.ok(err == 400);
    });
  });
});