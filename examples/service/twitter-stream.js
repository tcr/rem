var rem = require('../..');
var read = require('read');
var clarinet = require('clarinet');

// Create Twitter API, prompting for key/secret.
var tw = rem.load('twitter', 1.0).prompt();

// Authenticate user via the console.
rem.console(tw, function (err, user) {
  user.stream('statuses/sample').get(function (err, stream) {
    // Pass the stream to a JSON parser and only print the tweets.
    stream.pipe(clarinet.createStream()).on('key', function (key) {
      if (key == 'text') {
        this.once('value', function (tweet) {
          console.log(String(tweet));
        })
      }
    });
  });
});