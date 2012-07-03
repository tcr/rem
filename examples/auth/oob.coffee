rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Dropbox
# =======

# Create the API.
dbox = rem.load 'dropbox', '1',
	key: keys.dropbox.key
	secret: keys.dropbox.secret

# Oauth provider. Omitting the callback url triggers out-of-band mode.
oauth = rem.oauth(dbox)
oauth.start (url, token, secret) ->
	console.log "Visit:", url
	read prompt: "Hit enter when finished...", ->
		oauth.complete token, secret, example

# Authenticated REST demo.
example = (err, user) ->
	if err then console.log err; return

	# Create or update a file in your sandbox folder.
	user('files_put/sandbox/REM.txt').put 'text/plain', 'REM is hiding in your dropcube', (err, json) ->
		console.log 'PUT file: (error', err, ')'
		console.log json

	# List all files in your sandbox folder.
	user('metadata/sandbox/').get (err, json) ->
		console.log 'Sandbox contents: (error', err, ')'
		for f in json?.contents
			console.log ' -', f.path