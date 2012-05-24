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

# See server-oauth*.coffee for details on OAuth authentication.
rem.oauthConsole fb, scope: ["email", "publish_stream", "read_stream"], (err, user) ->

	user('me').get (err, json) ->
		console.log 'Your profile: (error', err, ')'
		console.log json

		#ask "Post a status update: ", /.*?/, (txt) ->
		#	fb("me/feed").post message: txt, (err, json) ->
		#		console.log err, json

		console.log 'Your latest image:'
		user('me/photos').get (err, json) ->
			rem.url(json.data[0].source).head (err, {}, res) ->
				console.log res.headers