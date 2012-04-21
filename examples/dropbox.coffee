rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

CALLBACK_URL = "http://localhost:3000/oauth/callback/"

# Launch server.
app = express.createServer()
app.get '/', (req, res) ->
	res.send 'OAuth server!'
app.listen 3000

# Dropbox
# =======

dbox = rem.load 'dropbox', '1',
	key: keys.dropbox.key
	secret: keys.dropbox.secret

# Get initial url.
dbox.auth.startCallback CALLBACK_URL, (url) ->
	console.log 'Visit:', url
# Use middleware to intercept OAuth callbacks.
# For this demo, when authenticated, we'll close the server and run an example.
app.use dbox.auth.middleware CALLBACK_URL, (req, res, next) ->
	res.send "Authenticated with Dropbox. (Closing server.)"
	req.socket.destroy(); app.close()
	process.nextTick example

# Authenticated REST demo.
example = ->

	# Create or update a file in your sandbox folder.
	dbox('files_put/sandbox/REM.txt').put 'text/plain', 'REM is hiding in your dropcube', (err, json) ->
		console.log err, json

	# List all files in your sandbox folder.
	dbox('metadata/sandbox/').get (err, json) ->
		console.log json