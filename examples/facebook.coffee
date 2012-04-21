rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

CALLBACK_URL = "http://localhost:3000/oauth/callback/"

# Launch server.
app = express.createServer()
app.get '/', (req, res) ->
	res.end 'OAuth server!'
app.listen 3000

# Facebook
# ========

fb = rem.load 'facebook', '1',
	key: keys.facebook.key
	secret: keys.facebook.secret

# Get initial url.
fb.auth.startCallback CALLBACK_URL, scope: ["email", "publish_stream", "read_stream"], (url) ->
	console.log 'Visit:', url
# Use middleware to intercept OAuth callbacks.
# For this demo, when authenticated, we'll close the server and run an example.
app.use fb.auth.middleware CALLBACK_URL, (req, res, next) ->
	res.end "Authenticated with Facebook. (Closing server.)"
	req.socket.destroy(); app.close()
	process.nextTick example

example = ->
	# Authenticated REST demo.
	fb('me').get (err, json) ->
		if err then console.error 'Facebook auth failed:', err; return
		console.log 'Facebook auth succeeded.'

		#ask "Post a status update: ", /.*?/, (txt) ->
		#	fb("me/feed").post message: txt, (err, json) ->
		#		console.log err, json

		fb('me/photos').get (err, json) ->
			rem.url(json.data[0].source).head (err, {}, res) ->
				console.log res.headers
				console.log 'Image size:', res.headers['content-length']

			read prompt: 'Filename to save your first facebook image to:', (err, file) ->
				req = rem.url(json.data[0].source).get()
				req.on 'response', (res) ->
					res.pipe(fs.createWriteStream(file))
					res.on 'end', -> console.log 'First image saved locally.'
