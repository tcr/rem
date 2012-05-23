rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Dropbox
# =======

# Create the API.
dbox = rem.load 'dropbox', '1',
	key: keys.dropbox.key
	secret: keys.dropbox.secret

# Launch server. Session middleware is required to use oauth middleware,
# so initialize the cookie parser and some session key.
app = express.createServer()
app.use(express.cookieParser())
app.use(express.session(secret: "some arbitrary secret"))
app.listen 3000

# Oauth provider.
oauth = rem.oauth(dbox, "http://localhost:3000/oauth/callback/")
# Use middleware to intercept OAuth callbacks for the callback URL specified earlier.
# Once authenticated, req.user is populated with an authenticated API object as long
# as the user is logged in. (Make sure this middleware precedes any route calls) 
app.use oauth.middleware (req, res, next) ->
	console.log "Authenticated user."
	res.redirect '/'

# Accessing the login URL starts the session by fetching a request token.
# We get a callback URL to the oauth login page, which we could redirect to, display, etc.
app.get '/login/', (req, res) ->
	oauth.startSession req, (url) ->
		res.redirect url

# Main page example.
app.get '/', (req, res) ->
	if not req.user
		res.write "<h1>Unauthenticated.</h1>"
		res.end "<a href='/login/'>Log in with OAuth</a>"

	else
		res.write '<h1>Authenticated.</h1>'

		# For fun, list all files in this Dropbox App's folder.
		req.user('metadata/sandbox/').get (err, json) ->
			res.write '<pre>'
			res.write 'Sandbox contents: (error ' + err + ')\n'
			for f in json?.contents
				res.write ' - ' + f.path + '\n'
			res.end()

# Convenience link for where to log in.
console.log 'Visit:', "http://localhost:3000/"