rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

CALLBACK_URL = "http://localhost:3000/oauth/callback/"

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
tw.auth.startCallback CALLBACK_URL, (url) ->
	console.log 'Visit:', url
# Use middleware to intercept OAuth callbacks.
# For this demo, when authenticated, we'll close the server and run an example.
app.use tw.auth.middleware CALLBACK_URL, (req, res, next) ->
	res.end "Authenticated with Twitter. (Closing server.)"
	req.socket.destroy(); app.close()
	process.nextTick example

# Authenticated REST demo.
example = ->

	# Get your newest tweets.
	console.log 'Latest tweets:'
	tw('statuses/home_timeline').get (err, json) ->
		for twt in json
			console.log twt.text