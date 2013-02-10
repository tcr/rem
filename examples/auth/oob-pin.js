// npm install rem read
var rem = require('rem')
  , fs = require('fs')
  , read = require('read');

var tw = rem.connect('twitter.com', 1.0)
  , oauth = rem.oauth(tw);

function oobPinLogin () {
  oauth.start(function(url, token, secret) {
    console.log("Visit:", url);
    read({
      prompt: "Type in the verification code: "
    }, function(err, verifier) {
      oauth.complete(verifier, token, secret, authorizedRequests);
    });
  });
}

function authorizedRequests (err, user) {
  if (err) return console.log(err);

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

// Prompt for API keys and begin login.
tw.promptConfiguration(oobPinLogin)