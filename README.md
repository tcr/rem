# REM. REST easy.

REM is a minimal library to consume REST APIs, constructed around simple
language idioms and manifests for popular libraries that alleviate
differences between between configuration, authentication, and formats.
Getting started with REM is quick and easy.

REM includes [configurations for several popular APIs](https://github.com/timcameronryan/rem).
Getting started with a particular API is as simple is specifying the name and API version:

    var rem = require('rem')
    var tw = rem.load('twitter', 1, {key: 'KEY', secret: 'SECRET'})
    // Get started with https://api.twitter.com/1

You can make API requests simply:

    tw('search').get({q: 'fleetwood mac', rpp: 5}, function(err, json) {
        console.log('There are', json.results.length, 'results for Fleetwood Mac. #awesome');
    });
    // requires authentication:
    tw('statuses/update').post({status: message}, function (err, json) {
		console.log(err, json)
	})

OAuth authentication parameters are already included. You can authenticate by using callbacks,
connect middleware, or out-of-band modes when available:

    tw.startOAuth(function (url, results) {
    	console.log("Visit:", url)
    	require('./examples/utils').ask("Verification code: ", /[\w\d]+/, function (verifier) {
		    tw.completeOAuth(verifier, function (results) {
		        // Authenticated calls with the Twitter API can be done here.
		    })
		})
    })

You can also define and load your own manifests for your own APIs:

    var api = rem.create({base: 'http://cozy.api/v1'}, {format: 'json'})

## Examples

Any example in the examples folder can be run from the command line:

    coffee examples/dropbox

For authentication, create a file called `examples/keys.json` with your
API keys and secrets, of the following format:

    {"tumblr": {"key": "KEY", "secret": "SECRET"}, "twitter": ...}

## License

MIT.