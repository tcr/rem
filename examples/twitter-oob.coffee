rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Twitter
# =======

tw = rem.load 'twitter', '1',
	key: keys.twitter.key
	secret: keys.twitter.secret

# Start out-of-band authentication.
tw.auth.start (url, results) ->
	console.log "Visit:", url
	ask "Please enter the verification code: ", /[\w\d]+/, (verifier) ->
		tw.auth.complete verifier, example

# Authenticated REST demo.
example = ->

	# Get your newest tweets.
	console.log 'Latest tweets:'
	tw('statuses/home_timeline').get (err, json) ->
		for twt in json
			console.log twt.text

		# Unauthenticated REST calls.
		tw('search').get {q: 'blue angels', rpp: 5}, (err, json) ->
			console.log 'Search: # of results for blue angels is', json.results.length

			# Then post a status.
			read prompt: "Enter a status to tweet: ", (txt) ->
				tw('statuses/update').post {status: txt}, (err, json) ->
					console.log err, json
