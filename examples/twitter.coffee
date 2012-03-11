REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Twitter
# =======

tw = new REM 'twitter', '1',
	key: keys.twitter.key
	secret: keys.twitter.secret

tw.startOAuth (url, results) ->
	console.log "Visit:", url
	ask "Please enter the verification code: ", /[\w\d]+/, (verifier) ->

		tw.completeOAuth verifier, (results) ->

			# Authenticated REST calls.
			#tw.get '/statuses/home_timeline', {}, (err, action) ->
			#	for twt in action.json
			#		console.log '[TWITTER]', twt.text

			ask "Enter a status to tweet: ", /.*/, (txt) ->
				tw.post '/statuses/update', {status: txt}, (err, action) ->
					console.log err, action?.json

#tw.get '/search', {q: 'blue angels', rpp: 5}, (err, action) ->
#	console.log '[TWITTER]', '# of results for blue angels is', action.json.results.length
