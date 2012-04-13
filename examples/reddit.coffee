rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Github
# ======

reddit = rem.load 'reddit', '1'

#reddit.get '/r/programming/comments/6nw57', {}, (err, action) ->
#	console.log JSON.stringify action.json

ask 'Username: ', /.*/, (user) ->
	ask 'Password: ', /.*/, (passwd) ->
		reddit.post '/api/login', {user, passwd}, (err, json) ->
			if err then console.log err; return

			# Begin authenticated requests here.
			reddit.get '/api/me', (err, json) ->
				console.log err, JSON.stringify json

			# Try restoring state and duplication requests.
			reddit.saveState (state) ->
				reddit = rem.load 'reddit', '1'
				reddit.loadState state
				reddit.get '/api/me', (err, json) ->
					console.log err, JSON.stringify json