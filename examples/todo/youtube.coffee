rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Youtube
# =======

console.log 'THIS EXAMPLE IS BROKEN. Try back later. :)'

yt = rem.load 'youtube', '2',
	key: 'anonymous'
	secret: 'anonymous'
#yt.key = keys.youtube.key

yt.startOAuth (url, results) ->
	console.log "Visit:", url
	ask "Please enter the verification code: ", /[\w\d]+/, (verifier) ->
		yt.completeOAuth verifier, (results) ->

			# Authenticated REST calls.
			yt('videos').get {q: 'surfing'}, (err, action) ->
				if err
					console.log 'Error', err, action?.text
				else
					console.log '[YOUTUBE]', 'Number of surfing videos:', action.json.data.totalItems