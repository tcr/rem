rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Dropbox
# =======

dbox = rem.load 'dropbox', '1',
	key: keys.dropbox.key
	secret: keys.dropbox.secret

# Start out-of-band authentication.
dbox.auth.start (url, results) ->
	console.log "Visit:", url
	ask "Hit enter when finished...", /.*/, ->
		dbox.auth.complete example

# Authenticated REST demo.
example = ->

	# Create or update a file in your sandbox folder.
	dbox('files_put/sandbox/REM.txt').put 'text/plain', 'REM is hiding in your dropcube', (err, json) ->
		console.log json

	# List all files in your sandbox folder.
	dbox('metadata/sandbox/').get (err, json) ->
		console.log json