rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'
express = require 'express'

# Launch server.
app = express.createServer()
app.get '/', (req, res) ->
	res.send 'OAuth server!'
app.listen 3000

# Google Docs
# ===========

docs = rem.load 'google-docs', '3',
	key: 'anonymous'
	secret: 'anonymous'
	format: 'xml'

# Get initial url.
docs.startOAuthCallback "http://localhost:3000/oauth/callback/", (url) ->
	console.log 'Visit:', url

# Use middleware to intercept OAuth calls.
app.use docs.oauthMiddleware '/oauth/callback/', ->
	console.log 'Authenticated with Google Docs.'

	# Authenticated REST calls.
	docs('default/private/full').get (err, xml) ->
		if err then console.log err; return
		
		# Returned as XML. See libxmljs for more bindings:
		# https://github.com/polotek/libxmljs
		for title in xml.find('/a:feed/a:entry/a:title', a: "http://www.w3.org/2005/Atom")
			console.log 'Document:', title.text()