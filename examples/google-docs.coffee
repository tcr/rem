rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

CALLBACK_URL = "http://localhost:3000/oauth/callback/"

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
	format: 'xml' # You must specifically mention formats other than 'json'.

# Get initial url.
docs.auth.startCallback CALLBACK_URL, (url) ->
	console.log 'Visit:', url
# Use middleware to intercept OAuth callbacks.
# For this demo, when authenticated, we'll close the server and run an example.
app.use docs.auth.middleware CALLBACK_URL, (req, res, next) ->
	res.send "Authenticated with Google Docs. (Closing server.)"
	req.socket.destroy(); app.close()
	process.nextTick example

# Authenticated REST demo.
example = ->

	# List of all documents.
	docs('default/private/full').get (err, xml) ->
		if err then console.log err; return
		
		# Returned as XML. See libxmljs for more bindings:
		# https://github.com/polotek/libxmljs
		for title in xml.find('/a:feed/a:entry/a:title', a: "http://www.w3.org/2005/Atom")
			console.log 'Document:', title.text()