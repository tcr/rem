rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'
express = require 'express'

# Launch server.
app = express.createServer()
app.get '/', (req, res) ->
	res.send 'OAuth server!'
app.listen 3000

# Twitter
# =======

# NOTE! You must set a callback for your API key on the Twitter
# developers page. This can be a dummy value if you choose (the
# value set in startOAuthCallback takes precedence). Not having
# this field set locks your API key to oob mode.

tw = rem.load 'twitter', '1',
	key: keys.twitter.key
	secret: keys.twitter.secret

# Get initial url.
tw.startOAuthCallback "http://localhost:3000/oauth/callback/", (url) ->
	console.log 'Visit:', url

# Use middleware to intercept OAuth calls.
app.use tw.oauthMiddleware '/oauth/callback/', ->
	console.log 'Authenticated with Twitter.'

	# Authenticated REST calls.
	tw('statuses/home_timeline').get (err, json) ->
		for twt in json
			console.log '[TWITTER]', twt.text