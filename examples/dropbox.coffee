REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Dropbox
# =======

dbox = new REM 'dropbox', '1'
dbox.key = keys.dropbox.key
dbox.secret = keys.dropbox.secret

dbox.startOAuth (url, results) ->
	console.log "Visit:", url
	ask "Hit enter when finished...", /.*/, ->
		dbox.completeOAuth (results) ->
			dbox.put '/files_put/sandbox/REM.txt', {}, 'text/plain', 'REM is hiding in your dropcube', (err, action) ->
				console.log action.json

		#dbox.get '/metadata/sandbox/', {}, (err, action) ->
		#	console.log action.json