rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Twitter
# =======

tw = rem.load 'twitter', '1',
	key: keys.twitter.key
	secret: keys.twitter.secret

# Unauthenticated REST calls.
tw.get '/search', {q: 'blue angels', rpp: 5}, (err, json) ->
	console.log 'Search: # of results for blue angels is', json.results.length

tw.startOAuth (url, results) ->
	console.log "Visit:", url
	
	ask "Please enter the verification code: ", /[\w\d]+/, (verifier) ->

		tw.completeOAuth verifier, (results) ->
			console.log 'Authorized.'

			# ...and authenticated REST calls.
			tw.get '/statuses/home_timeline', {}, (err, json) ->
				for twt in json
					console.log '[TWITTER]', twt.text


			ask "Enter a status to tweet: ", /.*/, (txt) ->
				tw.post '/statuses/update', {status: txt}, (err, json) ->
					console.log err, json
