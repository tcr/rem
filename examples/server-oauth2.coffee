rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Dropbox
# =======

# Create the API.
fb = rem.load 'facebook', '1',
	key: keys.facebook.key
	secret: keys.facebook.secret

# Launch server. Session middleware is required to use oauth middleware,
# so initialize the cookie parser and some session key.
app = express.createServer()
app.use(express.cookieParser())
app.use(express.session(secret: "some arbitrary secret"))
app.listen 3000

# Oauth provider.
oauth = rem.oauth(fb, "http://localhost:3000/oauth/callback/")
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

		# For fun, display all the user's profile information.
		req.user('me').get (err, json) ->
			res.write '<pre>'
			res.write 'Your profile: (error ' + err + ')\n'
			res.write JSON.stringify(json, null, '\t')
			res.end()

# Convenience link for where to log in.
console.log 'Visit:', "http://localhost:3000/"