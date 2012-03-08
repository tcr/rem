REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Youtube
# =======

yt = new REM 'youtube', '2'
#yt.key = keys.youtube.key
yt.key = 'anonymous'
yt.secret = 'anonymous'

yt.startOAuth (url, results) ->
	console.log "Visit:", url
	ask "Please enter the verification code: ", /[\w\d]+/, (verifier) ->
		yt.completeOAuth verifier, (results) ->
			yt.get '/videos', {q: 'surfing'}, (err, action) ->
				if err
					console.log 'Error', err, action?.text
				else
					console.log '[YOUTUBE]', 'Number of surfing videos:', action.json.data.totalItems