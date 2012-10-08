var rem = require('rem');
var fs = require('fs');
var read = require('read');

var tw = rem.load('twitter', 1.0).prompt();
var oauth = rem.oauth(tw);

oauth.start(function(url, token, secret) {
  console.log("Visit:", url);
  read({
    prompt: "Type in the verification code: "
  }, function(err, verifier) {
    oauth.complete(verifier, token, secret, authorized);
  });
});

function authorized (err, user) {
  if (err) {
    console.error(err);
    return;
  }

  console.log('Latest tweets from your timeline:');
  user('statuses/home_timeline').get(function(err, json) {
    json.forEach(function (twt) {
      console.log(' -', twt.text);
    });

    read({
      prompt: "Enter a status to tweet: "
    }, function (err, txt) {
      user('statuses/update').post({
        status: txt
      }, function (err, json) {
        console.log(err, json);
      });
    });
  });
}