# REM, Manifest-based REST Clients

REM provides a minimal library to access REST APIs. It defines many popular APIs
by manifest (and allows the user to define their own manifests) to smooth out
differences between configuration, authentication, and formats. As a result,
getting started with REM is consistent and easy.

## How it works

REM defines a manifest of common APIs in `rem-manifest.json`. For example, OAuth
endpoints, session cookies, or API domains are specified for the user. Getting
started with a particular API is as simple is specifying the name and API version:

    tw = new REM('twitter', 1, {key: 'KEY', secret: 'SECRET'}) // Get started with https://api.twitter.com/1

You can make API requests simply:

    tw.post('/statuses/update', {status: message}, function (err, action) {
		console.log(err, action && action.json)
	})

OAuth authentication is predefined in the manifest, and is possible in callback
or out-of-band modes (where available):

    tw.startOAuth(function (url, results) {
    	console.log("Visit:", url)
    	ask("Please enter the verification code: ", /[\w\d]+/, function (verifier) {
		    tw.completeOAuth(verifier, function (results) {
		        // Authenticated calls with the Twitter API can be done here.
		    })
		})
    })

## Examples

You should create a file called `keys.json` in examples with your API keys and secrets,
in the following format:

    {"tumblr": {"key": "KEY", "secret": "SECRET"}, "twitter": ...}

Then, any example in the examples folder can be run from the command line:

    coffee examples/youtube

## TODO

* When the API specifies it, extract rate limit/remaining options.
* Make a REM implementation in other languages (Python, client-side JS)
* Support more APIs
* Allow user to programmatically defining own API manifests