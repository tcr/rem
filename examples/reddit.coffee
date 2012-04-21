rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Github
# ======

reddit = rem.load 'reddit', '1'

# Reddit uses cookies for authentication. Hit the api/login
# endpoint, and your remaining session will be authentication.
read prompt: 'Username: ', (err, user) ->
	read prompt: 'Password: ', silent: yes, (err, passwd) ->
		reddit('api/login').post {user, passwd}, (err, json) ->
			if err then console.log err; return
			process.nextTick example

# Authenticated REST demo.
example = ->

	# Get your account.
	reddit('api/me').get (err, json) ->
		if err then console.log err; return
		console.log 'Your account:', JSON.stringify json, null, '  '