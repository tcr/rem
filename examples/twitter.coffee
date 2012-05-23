rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Twitter
# =======

# Create the API.
tw = rem.load 'twitter', '1',
	key: keys.twitter.key
	secret: keys.twitter.secret

# Oauth provider. Omitting the callback url triggers out-of-band mode.
oauth = rem.oauth(tw)
oauth.start (url, token, secret) ->
	console.log "Visit:", url
	read prompt: "Type in the verification code: ", (err, verifier) ->
		oauth.complete verifier, token, secret, example

# Authenticated REST demo.
example = (err, user) ->
	if err then console.error err; return

	# Get your newest tweets.
	console.log 'Latest tweets from your timeline:'
	user('statuses/home_timeline').get (err, json) ->
		for twt in json
			console.log ' -', twt.text
			
		# Then post a status.
		read prompt: "Enter a status to tweet: ", (err, txt) ->
			user('statuses/update').post {status: txt}, (err, json) ->
				console.log err, json
