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

# Github
# ======

github = rem.load 'github', '1',
	key: keys.github.key
	secret: keys.github.secret

# Get initial url.
github.auth.startCallback CALLBACK_URL, scope: ["user", "repo"], (url) ->
	console.log 'Visit:', url
# Use middleware to intercept OAuth callbacks.
# For this demo, when authenticated, we'll close the server and run an example.
app.use github.auth.middleware CALLBACK_URL, (req, res, next) ->
	res.send "Authenticated with Github. (Closing server.)"
	req.socket.destroy(); app.close()
	process.nextTick example

# Authenticated REST demo.
example = ->
	console.log 'Your gists:'
	github('user').get (err, profile) ->
		github("users/#{profile.login}/gists").get (err, json) ->
			for gist in json
				console.log gist.description