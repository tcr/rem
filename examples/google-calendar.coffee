rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Google Calendar
# ===============

gcal = rem.load 'google-calendar', '3',
	key: keys.google.key
	secret: keys.google.secret

# See oob-pin.coffee for details on OAuth authentication.
rem.oauthConsole gcal, (err, user) ->
		
	# Authenticated REST calls.
	user('users/me/calendarList').get (err, json) ->
		if err then console.log err; return

		console.log 'Your calendars:'
		for cal in json.items
			console.log ' -', cal.summary