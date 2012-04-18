rem = require '../rem'
fs = require 'fs'
express = require 'express'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

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
github.startOAuthCallback "http://localhost:3000/oauth/callback/",
	scope: ["user", "repo"], (url) ->
		console.log 'Visit:', url

# Use middleware to intercept OAuth calls.
app.use github.oauthMiddleware '/oauth/callback/', (req, res, next) ->
	res.send "Authenticated with Github."

	# Authenticated REST calls start here.

	console.log 'Your gists:'
	github('user').get (err, profile) ->
		github("users/#{profile.login}/gists").get (err, json) ->
			for gist in json
				console.log gist.description