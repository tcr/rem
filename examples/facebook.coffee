rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Facebook
# ========

# Create the API.
fb = rem.load 'facebook', '1',
	key: keys.facebook.key
	secret: keys.facebook.secret
# Permissions.
scope = ["email", "publish_stream", "read_stream"]

# Use a server to perform OAuth when out-of-band is unavailable.
# See server-oauth2.coffee for more detail on server authentication.
oauth = rem.oauth(fb, "http://localhost:3000/oauth/callback/")
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

	user('me').get (err, json) ->
		if err then console.error 'Facebook auth failed:', err; return
		console.log 'Your profile: (error', err, ')'
		console.log json

		#ask "Post a status update: ", /.*?/, (txt) ->
		#	fb("me/feed").post message: txt, (err, json) ->
		#		console.log err, json

		console.log 'Your latest image:'
		user('me/photos').get (err, json) ->
			rem.url(json.data[0].source).head (err, {}, res) ->
				console.log res.headers