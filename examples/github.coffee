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

# See server-oauth*.coffee for details on OAuth authentication.
rem.oauthConsole github, scope: ["user", "repo"], (err, user) ->

	console.log 'Your gists:'
	user('user').get (err, profile) ->
		user("users/#{profile.login}/gists").get (err, json) ->
			for gist in json
				console.log ' -', gist.description