rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'
express = require 'express'

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
dbox.startOAuthCallback "http://localhost:3000/oauth/callback/", (url) ->
	console.log 'Visit:', url

# Use middleware to intercept OAuth calls.
app.use dbox.oauthMiddleware '/oauth/callback/', (req, res, next) ->
	res.send "Authenticated with Dropbox."

	# Authenticated calls.
	dbox('files_put/sandbox/REM.txt').put 'text/plain', 'REM is hiding in your dropcube', (err, json) ->
		console.log err, json