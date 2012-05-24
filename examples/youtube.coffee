rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Youtube
# =======

yt = rem.load 'youtube', '2',
	key: keys.youtube.key
	secret: keys.youtube.secret
	devkey: keys.youtube.devkey
	format: 'xml'

# See server-oauth2.coffee for details on OAuth authentication.
rem.oauthConsole yt, (err, user) ->

	# Authenticated REST calls.
	user('users/default').get (err, xml) ->
		if err then console.error err; return
		
		console.log 'Your profile: (error', err, ')'
		for prop in xml.find('/a:entry/*', a: "http://www.w3.org/2005/Atom")
			if prop.text()
				console.log ' -', prop.name() + ':', prop.text()