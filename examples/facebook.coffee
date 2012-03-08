REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Facebook
# ========

fb = new REM 'facebook', '1'
fb.key = keys.facebook.key
fb.secret = keys.facebook.secret

#fb.get '/btaylor', {}, (err, action) ->
#	console.log '[FACEBOOK]', action?.json

fb.startOAuthCallback "https://www.facebook.com/connect/login_success.html", (url) ->
	console.log "Visit:", url
	ask "Please enter the full response url: ", /[\w\d]+/, (url) ->

		fb.completeOAuthCallback url, ->
			fb.get '/me', {}, (err, action) ->
				if err
					console.log 'Facebook auth failed:', err
					return

				console.log 'Facebook auth succeeded:', action?.json
				ask "Post a status update: ", /.*/, (txt) ->
					fb.post "/me/feed", message: txt, (err, action) ->
						console.log err, action