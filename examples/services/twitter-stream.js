// npm install rem read clarinet
var rem = require('rem');
var read = require('read');
var carrier = require('carrier');

// Create Twitter API, prompting for key/secret.
var tw = rem.connect('twitter.com', 1.1).prompt(function(err, user){

  // Pass the statuses/sample stream to a JSON parser and print only the tweets.
  user.stream('statuses/sample').get(function (err, stream) {
    carrier.carry(stream, function(line){
      var line = JSON.parse(line);
      //Filter DELETE requests from stream
      if (!line.delete){
        console.log(line.text);
      }
    });
  });
});
