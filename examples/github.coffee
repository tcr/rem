rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Github
# ======

# Create the API.
github = rem.load 'github', '1',
	key: keys.github.key
	secret: keys.github.secret
# Permissions.
scope = ["user", "repo"]

# Use a server to perform OAuth when out-of-band is unavailable.
# See server-oauth2.coffee for more detail on server authentication.
oauth = rem.oauth(github, "http://localhost:3000/oauth/callback/")
app = express.createServer(express.cookieParser(), express.session(secret: "!"))
app.use oauth.middleware (req, res, next) ->
	res.send "Authenticated user. Check your console, hero."
	process.nextTick -> example req.user
app.get '/login/', (req, res) ->
	oauth.startSession req, scope: scope, (url) ->
		res.redirect url
app.listen 3000
console.log 'Visit:', "http://localhost:3000/login/"

# Authenticated REST demo.
example = (user) ->

	console.log 'Your gists:'
	user('user').get (err, profile) ->
		user("users/#{profile.login}/gists").get (err, json) ->
			for gist in json
				console.log ' -', gist.description