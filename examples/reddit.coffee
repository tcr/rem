rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Github
# ======

reddit = rem.load 'reddit', '1'

# Session handler.
session = rem.session(reddit)
# Reddit uses cookies for authentication. Hit the api/login
# endpoint, and your remaining session will be authentication.
read prompt: 'Username: ', (err, user) ->
	read prompt: 'Password: ', silent: yes, (err, password) ->
		session.authenticate user, password, example

# Authenticated REST demo.
example = (err, user) ->
	if err then console.log err; return

	# Get your account.
	user('api/me').get (err, json) ->
		if err then console.log err; return
		console.log 'Your account:', JSON.stringify json, null, '  '