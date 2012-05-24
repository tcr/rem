rem = require '../rem'
fs = require 'fs'
read = require 'read'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Google Documents
# ================

docs = rem.load 'google-docs', '3',
	key: keys.google.key
	secret: keys.google.secret
	format: 'xml'

# See oob-pin.coffee for details on OAuth authentication.
rem.oauthConsole docs, (err, user) ->

	# Authenticated REST calls.
	user('default/private/full').get (err, xml) ->
		if err then console.log err; return
		
		# Returned as XML. See libxmljs for more bindings:
		# https://github.com/polotek/libxmljs
		for title in xml.find('/a:feed/a:entry/a:title', a: "http://www.w3.org/2005/Atom")
			console.log 'Document:', title.text()