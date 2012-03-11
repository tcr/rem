REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Github
# ======

reddit = new REM 'reddit', '1'

#reddit.get '/r/programming/comments/6nw57', {}, (err, action) ->
#	console.log JSON.stringify action.json

ask 'Username: ', /.*/, (user) ->
	ask 'Password: ', /.*/, (passwd) ->
		reddit.post '/api/login', {user, passwd}, (err, action) ->
			if err then console.log err; return

			# Begin authenticated requests here.
			reddit.get '/api/me', (err, action) ->
				console.log JSON.stringify action.json

			# Try restoring state and duplication requests.
			reddit.saveState (state) ->
				reddit = new REM 'reddit', '1'
				reddit.loadState state
				reddit.get '/api/me', (err, action) ->
					console.log JSON.stringify action.json