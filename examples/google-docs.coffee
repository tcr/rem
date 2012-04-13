rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Google Calendar
# ===============

console.log 'THIS EXAMPLE IS BROKEN. Try back later. :)'

docs = rem.load 'google-docs', '3',
	key: 'anonymous'
	secret: 'anonymous'

docs.startOAuth (url, results) ->
	console.log "Visit:", url
	ask "Please enter the verification code: ", /[\w\d]+/, (verifier) ->
		docs.completeOAuth verifier, (results) ->

			# Authenticated REST calls.
			docs.get '/default/private/full', {}, (err, action) ->
				if err then console.log err; return
				
				# Returned as XML. See libxmljs for more bindings:
				# https://github.com/polotek/libxmljs
				for title in action.xml.find('/a:feed/a:entry/a:title', a: "http://www.w3.org/2005/Atom")
					console.log 'Document:', title.text()