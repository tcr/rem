// npm install rem read clarinet
var rem = require('rem');
var read = require('read');
var clarinet = require('clarinet');

// Create Twitter API, prompting for key/secret.
var tw = rem.connect('twitter', 1.0).prompt();

// Authenticate user via the console.
rem.console(tw, function (err, user) {

  // Pass the statuses/sample stream to a JSON parser and print only the tweets.
  user.stream('statuses/sample').get(function (err, stream) {
    stream.pipe(clarinet.createStream()).on('key', function (key) {
      if (key == 'text') {
        this.once('value', function (tweet) {
          console.log(String(tweet));
        })
      }
    });
  });
});