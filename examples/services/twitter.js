// npm install rem read clarinet
var rem = require('rem');
var read = require('read');

// Create Twitter API, prompting for key/secret.
var tw = rem.connect('twitter.com', 1.1).prompt(function(err, user){
  // Read tweets from our timeline.
  console.log('Latest tweets from your timeline:');
  user('statuses/home_timeline').get(function (err, json) {
    json.forEach(function (tweet) {
      console.log(' -', tweet.text);
    });

    // Post a tweet.
    read({prompt: "Enter a status to tweet: "}, function (err, txt) {
      user('statuses/update').post({
        status: txt
      }, function (err, json) {
        console.log(err, json);
      });
    });
  });
});

