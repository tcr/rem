REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Google Calendar
# ===============

gcal = new REM 'google-calendar', '2'
gcal.key = 'anonymous'
gcal.secret = 'anonymous'

gcal.startOAuth (url, results) ->
	console.log "Visit:", url
	ask "Please enter the verification code: ", /[\w\d]+/, (verifier) ->
		gcal.completeOAuth verifier, (results) ->
			gcal.get '/default/allcalendars/full', {}, (err, action) ->
				if err
					console.log err
				else
					for cal in action.json.data.items
						console.log '[GCAL]', cal.title