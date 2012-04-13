rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Dropbox
# =======

dbox = rem.load 'dropbox', '1',
	key: keys.dropbox.key
	secret: keys.dropbox.secret

dbox.startOAuth (url, results) ->
	console.log "Visit:", url
	ask "Hit enter when finished...", /.*/, ->
		dbox.completeOAuth (results) ->
			dbox.put '/files_put/sandbox/REM.txt', {}, 'text/plain', 'REM is hiding in your dropcube', (err, json) ->
				console.log json

		#dbox.get '/metadata/sandbox/', {}, (err, action) ->
		#	console.log action.json