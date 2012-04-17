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

# Facebook
# ========

fb = rem.load 'facebook', '1',
	key: keys.facebook.key
	secret: keys.facebook.secret

# Get initial url.
fb.startOAuthCallback "http://localhost:3000/oauth/callback/",
	scope: ["email", "publish_stream", "read_stream"], (url) ->
		console.log 'Visit:', url

# Use middleware to intercept OAuth calls.
app.use fb.oauthMiddleware '/oauth/callback/', ->

	# Authenticated REST calls start here.

	fb('me').get (err, json) ->
		if err then console.error 'Facebook auth failed:', err; return
		console.log 'Facebook auth succeeded. (Closing server.)'
		app.close()

		#ask "Post a status update: ", /.*/, (txt) ->
		#	fb("me/feed").post message: txt, (err, json) ->
		#		console.log err, json

		fb('me/photos').get (err, json) ->
			rem.url(json.data[0].source).head (err, {}, res) ->
				console.log 'Image size:', res.headers['content-type']

			req = rem.url(json.data[0].source).get()
			req.on 'response', (res) ->
				res.pipe(fs.createWriteStream("firstimage.jpg"))
				res.on 'end', -> console.log 'First image saved locally.'