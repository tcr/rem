var rem = require('../rem');
var read = require('read');

// Create our Twitter console.
rem.myConsole('twitter', 1.0, function(err, user) {

  // Read tweets from our timeline.
  console.log('Latest tweets from your timeline:');
  user('statuses/home_timeline').get(function (err, json) {
    for (var i = 0; i < json.length; i++) {
      console.log(' -', json[i].text);
    }

    // Post a tweet.
    read({prompt: "Enter a status to tweet: "}, function (err, txt) {
      user('statuses/update').post({status: txt}, function (err, json) {
        console.log(err, json);
      });
    });
  });
});