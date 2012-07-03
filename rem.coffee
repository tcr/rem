###

REM: Remedial Rest Interfaces

A library that simplifies and normalizes access to REST APIs.

See more:
http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven

###

querystring = require 'querystring'
https = require 'https'
http = require 'http'
util = require 'util'
fs = require 'fs'
Q = require 'q'
read = require 'read'
express = require 'express'
# Conditional requires.
libxmljs = null

# Config
USER_AGENT = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://rem.tcr.io/)'

# Alias
rem = exports

# Utilities
# ---------

callable = (obj) ->
	f = (args...) -> f.call args...
	f.__proto__ = obj
	return f

JSON.clone = (obj) -> JSON.parse JSON.stringify obj

Object.merge = (base, args...) ->
	for arg in args
		for k, v of arg
			if base[k] and v and typeof base[k] == 'object' and typeof v == 'object' and base[k].constructor != Array and v.constructor != Array
				base[k] = Object.merge base[k], v
			else
				base[k] = v
	return base

class Url 
	constructor: (str) ->
		{@protocol, @auth, @hostname, @port, @pathname, @query, @hash} = require('url').parse str, yes
		@query ?= {}

	clone: -> new Url @toString()
	toString: -> require('url').format this
	toOptions: ->
		{hostname, port, path} = require('url').parse @toString()
		return {hostname, port, path}


iterateJSON = (obj, level, fn) ->
	fn(obj, level)
	if typeof obj == 'object' and obj
		if obj.constructor == Array
			iterateJSON(x, level.concat([i]), fn) for x, i in obj
		else
			iterateJSON(x, level.concat([k]), fn) for k, x of obj
	return

safeJSONStringify = (s) ->
	JSON.stringify(s).replace /[\u007f-\uffff]/g, (c) -> "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4)

sendHttpRequest = (method, endpointUrl, mime, body, handlers = {}) ->
	# Create HTTP(S) request.
	endpoint = new Url endpointUrl
	opts = endpoint.toOptions()
	opts.method = method
	req = (if endpoint.protocol == 'https:' then https else http).request opts

	# Request response handler.
	if handlers.data
		req.on 'response', (res) =>
			# Attempt to follow Location: headers.
			if res.statusCode in [301, 302, 303] and res.headers['location']
				try
					sendHttpRequest method, res.headers['location'], mime, body, handlers
				catch e
				return

			# Read content.
			text = ''
			unless res.headers['content-type'] or res.headers['content-length'] then handlers.data 0, text, res
			res.on 'data', (d) => text += d
			res.on 'end', => handlers.data 0, text, res

	# Send request.
	req.setHeader 'Host', opts.hostname
	req.setHeader 'User-Agent', USER_AGENT
	req.setHeader 'Content-Type', mime if mime?
	req.setHeader 'Content-Length', body.length if body?
	# Header callback.
	handlers.headers ?= (req, next) -> next()
	handlers.headers req, ->
		req.write body if body?
		req.end()

	# Return request emitter.
	return req

# REM Classes
# -----------

# Parsed hypermedia response and helper methods.

class HyperMedia
	constructor: (@res, @type, @text) ->
		@statusCode = Number(@res.statusCode)
		@errorCode = if @statusCode > 400 then @statusCode else 0
		
		# Parse body
		try
			if @type == 'xml'
				@data = @xml = (libxmljs ?= require('libxmljs')).parseXmlString @text
			else
				@data = @json = JSON.parse @text
		catch e

	# TODO(tcr) pagination.
	
	###
	parseRate: ->
		@rate =
			limit: Number @res.headers['x-ratelimit-limit']
			remaining: Number @res.headers['x-ratelimit-remaining']
	
	parseHrefs: ->
		@hrefs = if @json.constructor == Array then [] else {}
		iterateJSON @json, [], (obj, level) =>
			if typeof obj == 'string' and obj.match /^https?:\/\/api\.tumblr\.com\//
				cur = @hrefs
				for k in level[0...-1]
					unless cur[k]?
						cur[k] = if String(Number(k)) == k then [] else {}
					cur = cur[k]
				cur[level[-1..][0]] = obj
	###

# Route for a given path or URL.

class Route
	constructor: (@url, @defaultBodyMime = 'form', @send) ->

	get: ([query]..., fn = null) ->
		url = @url.clone()
		Object.merge url.query, (query or {})
		return @send 'get', url.toString(), null, null, fn

	head: ([query]..., fn = null) ->
		url = @url.clone()
		Object.merge url.query, (query or {})
		return @send 'head', url.toString(), null, null, fn

	post: ([mime]..., data, fn = null) ->
		return @send 'post', @url.toString(), mime ? @defaultBodyMime, data, fn

	put: ([mime]..., data, fn = null) ->
		return @send 'put', @url.toString(), mime ? @defaultBodyMime, data, fn

	delete: (fn = null) ->
		return @send 'delete', @url.toString(), null, null, fn

# A REM API.

class API
	constructor: (@manifest, @opts = {}) ->
		# Load key, secret
		{@key, @secret, @format} = @opts

		# Load format-specific options.
		@format ?= 'json'
		@manifest.formats ?= {json: {}}
		if !@manifest.formats[@format]? then throw new Error "Format \"#{@format}\" not available. Please specify an available format in the options parameter."
		@manifest = Object.merge {}, @manifest, @manifest.formats[@format] or {}

		# Add filter methods
		@filters = []
		if @manifest.basepath?
			@filters.push (endpoint) => endpoint.pathname = @manifest.basepath + endpoint.pathname
		if @manifest.suffix?
			@filters.push (endpoint) => endpoint.pathname += @manifest.suffix
		if @manifest.configParams?
			@filters.push (endpoint) =>
				for ck, cv of @manifest.configParams then endpoint.query[ck] = @opts[cv]
		if @manifest.params?
			@filters.push (endpoint) =>
				for qk, qv of @manifest.params then endpoint.query[qk] = qv

		# Add auth methods.
		#@auth = new authtypes[@manifest.auth?.type ? 'unauthenticated'] this, @manifest.auth

	call: (pathname, query) ->
		url = new Url('')
		url.pathname = pathname
		url.query = query

		# Return a new route with data preparation.
		return new Route url, @manifest.uploadFormat,
			(method, path, mime, body, cb = null) =>
				# Expand payload shorthand.
				if typeof body == 'object'
					[mime, body] = switch mime
						when 'form', 'application/x-www-form-urlencoded' 
							['application/x-www-form-urlencoded', querystring.stringify(body)]
						when 'json', 'application/json'
							['application/json', safeJSONStringify(body)]
						else
							[mime, body]
				# Normalize path.
				path = path.replace(/^(?!\/)/, '/')

				# Determine base that matches path name.
				if typeof @manifest.base == 'string'
					base = @manifest.base
				else
					base = ''
					for patt in @manifest.base
						if typeof patt == 'string'
							base = patt
							break
						if path.match new RegExp(patt[0])
							base = patt[1]
							break
				# Construct complete endpoint path.
				endpoint = new Url base + path
				# Apply manifest filters.
				for filter in @filters
					filter endpoint

				# Process HTTP request through authentication scheme.
				@processRequest method, endpoint.toString(), mime, body, (err, data, res) =>
					# User callbacks.
					return unless cb
					if err
						cb(err, null, null)
					else
						media = new HyperMedia res, @format, data
						cb media.errorCode, media.data, media

	processRequest: (method, endpointUrl, mime, body, cb) ->
		sendHttpRequest method, endpointUrl, mime, body, data: cb

	# Root request shorthand.

	get: (args...) -> @('').get args...
	post: (args...) -> @('').post args...
	delete: (args...) -> @('').delete args...
	head: (args...) -> @('').head args...
	put: (args...) -> @('').put args...
	patch: (args...) -> @('').patch args...

	# Save/restore state.

	saveState: (cb) ->
		@auth.saveState cb

	loadState: (data, cb = null) ->
		@auth.loadState data, cb

# Authentication Mechanisms
# =========================

# Cookie Session Auth
# -------------------

{Cookie, CookieJar} = require 'tough-cookie'

class CookieSessionAPI extends API
	constructor: (manifest, opts) ->
		# Configuration.
		super

	processRequest: (method, endpointUrl, mime, body, cb) ->
		# HTTP Request.
		sendHttpRequest method, endpointUrl, mime, body,
			data: cb
			headers: (req, next) =>
				req.setHeader 'Cookie', @opts.cookies
				next()

	saveState: (next) ->
		next {cookies: @opts.cookies}

class CookieSessionAuthentication
	constructor: (@api) ->

	authenticate: (username, password, cb) ->		
		# HTTP Request.
		jar = new CookieJar()
		endpointUrl = 'http://www.reddit.com/api/login'
		sendHttpRequest 'POST', endpointUrl,
			'application/x-www-form-urlencoded', querystring.stringify({user: username, passwd: password}),
			data: (err, data, res) =>
				# Read cookies.
				if res.headers['set-cookie'] instanceof Array
					cookies = res.headers['set-cookie'].map Cookie.parse
				else if res.headers['set-cookie']?
					cookies = [Cookie.parse(res.headers['set-cookie'])]

				# Set cookies.
				Q.all(
					for cookie in (cookies or []) when cookie.key in @api.manifest.auth.cookies
						deferred = Q.defer()
						jar.setCookie cookie, endpointUrl, (err, r) ->
							if err then deferred.reject err
							else deferred.resolve()
						deferred.promise
				).then =>
					jar.getCookieString endpointUrl, (err, cookies) =>
						process.nextTick => @loadState {cookies}, cb

	loadState: (data, cb) ->
		opts = JSON.clone @api.opts
		opts.cookies = data.cookies
		cb 0, callable new CookieSessionAPI @api.manifest, opts

exports.session = (api) -> new CookieSessionAuthentication(api)

# OAuth
# -----

# version = '1.0', '1.0a', '2.0'
# scopeSeparator
# validate
# oob
# oobCallback
# oobVerifier

nodeoauth = require("oauth")

exports.oauth = (api, callback) ->
	switch String(api.manifest.auth.version).toLowerCase()
		when '1.0', '1.0a' then exports.oauth1(api, callback)
		when '2.0' then exports.oauth2(api, callback)
		else throw new Error 'Invalid OAuth version ' + api.manifest.auth.version

# OAuth 1
# -------

# requestEndpoint
# accessEndpoint
# authorizeEndpoint

class OAuth1API extends API
	constructor: (manifest, opts) ->
		# Configuration.
		super
		@config = @manifest.auth

		@oauth = new nodeoauth.OAuth @config.requestEndpoint, @config.accessEndpoint,
			@opts.key, @opts.secret, @config.version or '1.0', @opts.oauthRedirect, "HMAC-SHA1", null,
			{'User-Agent': USER_AGENT, "Accept": "*/*", "Connection": "close"}

	saveState: (next) ->
		next {
			oauthAccessToken: @opts.oauthAccessToken
			oauthAccessSecret: @opts.oauthAccessSecret
		}

	saveSession: (req, cb) ->
		req.session.oauthAccessToken = @opts.oauthAccessToken
		req.session.oauthAccessSecret = @opts.oauthAccessSecret
		req.user = this
		cb(req)

	processRequest: (method, endpointUrl, mime, body, cb) ->
		# OAuth request.
		payload = if method in ['put', 'post']
			# Signatures need to be calculated from forms; let node-oauth do that
			if mime == 'application/x-www-form-urlencoded' then [querystring.parse body]
			else [body, mime]
		else []
		return @oauth[method] endpointUrl, @opts.oauthAccessToken, @opts.oauthAccessSecret, payload..., cb

	validate: (cb) ->
		if not @config.validate
			throw new Error 'Manifest does not define mechanism for validating OAuth.'

		this(@config.validate).get (err, data) ->
			cb err

class OAuth1Authentication
	constructor: (@api, redirect = null) ->
		# Configuration.
		@config = @api.manifest.auth
		# Get redirect URL.
		@oob = not redirect
		unless redirect or @config.oob
			throw new Error 'Out-of-band OAuth for this API is not permitted.'
		@oauthRedirect = redirect or @config.oobCallback or `undefined`

		@oauth = new nodeoauth.OAuth @config.requestEndpoint, @config.accessEndpoint,
			@api.key, @api.secret, @config.version or '1.0', @oauthRedirect, "HMAC-SHA1", null,
			{'User-Agent': USER_AGENT, "Accept": "*/*", "Connection": "close"}

	start: ([params]..., cb) ->
		# Filter parameters.
		params = Object.merge (params or {}), (@config.params or {})
		if params.scope? and typeof params.scope == 'object'
			params.scope = params.scope.join(@config.scopeSeparator or ' ')
		# Needed for Twitter, etc.
		if @oauthRedirect then params['oauth_callback'] = @oauthRedirect

		@oauth.getOAuthRequestToken params, (err, oauthRequestToken, oauthRequestSecret, results) =>
			if err
				console.error "Error requesting OAuth token: " + JSON.stringify(err)
			else
				authurl = new Url(@config.authorizeEndpoint)
				authurl.query.oauth_token = oauthRequestToken
				if @oauthRedirect then authurl.query.oauth_callback = @oauthRedirect
				cb authurl.toString(), oauthRequestToken, oauthRequestSecret, results

	complete: ([verifier]..., oauthRequestToken, oauthRequestSecret, cb) ->
		if not verifier and (not @oob or @config.oobVerifier)
			throw new Error 'Out-of-band OAuth for this API requires a verification code.'
		if not @oob
			verifier = new Url(verifier).query.oauth_verifier

		@oauth.getOAuthAccessToken oauthRequestToken, oauthRequestSecret, verifier,
			(err, oauthAccessToken, oauthAccessSecret, results) =>
				if err
					console.error "Error authorizing OAuth endpoint: " + JSON.stringify(err)
					cb err, null, results
				else
					@loadState {oauthAccessToken, oauthAccessSecret, @oauthRedirect}, (user) ->
						cb err, user, results

	loadState: (data, next) ->
		opts = JSON.clone @api.opts
		opts.oauthAccessToken = data.oauthAccessToken
		opts.oauthAccessSecret = data.oauthAccessSecret
		opts.oauthRedirect = @oauthRedirect
		next callable(new OAuth1API @api.manifest, opts)

	startSession: (req, [params]..., cb) ->
		@start params, (url, oauthRequestToken, oauthRequestSecret, results) ->
			req.session.oauthRequestToken = oauthRequestToken
			req.session.oauthRequestSecret = oauthRequestSecret
			cb url, results

	clearSession: (req, cb) ->
		delete req.session.oauthAccessToken
		delete req.session.oauthAccessSecret
		delete req.session.oauthRequestToken
		delete req.session.oauthRequestSecret
		cb()
	
	loadSession: (req, cb) ->
		@loadState {
			oauthAccessToken: req.session.oauthAccessToken
			oauthAccessSecret: req.session.oauthAccessSecret
		}, (user) ->
			req.user = user
			cb()

	middleware: (cb) ->
		path = new Url(@oauthRedirect).pathname
		return (req, res, next) =>
			if req.path == path
				@complete req.url, req.session.oauthRequestToken, req.session.oauthRequestSecret,
					(err, user, results) =>
						user.saveSession req, ->
							cb(req, res, next)
			else
				if req.session.oauthAccessToken? and req.session.oauthAccessSecret?
					@loadSession(req, next)
				else
					next()

exports.oauth1 = (api, callback) -> new OAuth1Authentication(api, callback)

# OAuth 2
# -------

#oldreq = OAuth2::_request
#OAuth2::_request = (method, url, headers, body, accessToken, cb) ->
#	header['User-Agent'] = USER_AGENT
#	oldreq.call this, method, url, headers, body, accessToken, cb
#OAuth2::get = (url, accessToken, body, mime, cb) ->
#	@_request "GET", url, {}, "", accessToken, cb
nodeoauth.OAuth2::post = (url, accessToken, body, mime, cb) ->
	@_request "POST", url, {"Content-Type": mime}, body, accessToken, cb
nodeoauth.OAuth2::put = (url, accessToken, body, mime, cb) ->
	@_request "PUT", url, {"Content-Type": mime}, body, accessToken, cb
nodeoauth.OAuth2::delete = (url, accessToken, body, mime, cb) ->
	@_request "DELETE", url, {}, "", accessToken, cb

# base

class OAuth2API extends API
	constructor: (manifest, opts) ->
		# Configuration.
		super
		@config = @manifest.auth
		@oauth = new nodeoauth.OAuth2 @opts.key, @opts.secret, @config.base

	processRequest: (method, endpointUrl, mime, body, cb) ->
		payload = if method in ['put', 'post'] then [body, mime] else []
		return @oauth[method] endpointUrl, @opts.oauthAccessToken, payload..., cb

	validate: (cb) ->
		if not @opts.validate
			throw new Error 'Manifest does not define mechanism for validating OAuth.'

		this(@opts.validate).get (err, data) ->
			cb err

	saveState: (next) ->
		next {
			oauthRedirect: @opts.oauthRedirect
			oauthAccessToken: @opts.oauthAccessToken
			oauthRefreshToken: @opts.oauthRefreshToken
		}

	saveSession: (req, cb) ->
		req.session.oauthAccessToken = @opts.oauthAccessToken
		req.session.oauthRefreshToken = @opts.oauthRefreshToken
		req.user = this
		cb(req)

class OAuth2Authentication
	constructor: (@api, redirect) ->
		@config = @api.manifest.auth
		# Get redirect URL.
		@oob = not redirect
		unless redirect or @config.oob
			throw new Error 'Out-of-band OAuth for this API is not permitted.'
		@oauthRedirect = redirect or @config.oobCallback or `undefined`

		@oauth = new nodeoauth.OAuth2 @api.key, @api.secret, @config.base, @config.authorizePath, @config.tokenPath

	start: ([params]..., cb) ->
		params = Object.merge (@config.params or {}), (params or {})
		if params.scope? and typeof params.scope == 'object'
			params.scope = params.scope.join(@config.scopeSeparator or ' ')

		params.redirect_uri = @oauthRedirect
		cb @oauth.getAuthorizeUrl(params)

	complete: (verifier, [token, secret]..., cb) ->
		if not @oob
			verifier = new Url(verifier).query.code

		@oauth.getOAuthAccessToken verifier, redirect_uri: @oauthRedirect, grant_type: 'authorization_code',
			(err, oauthAccessToken, oauthRefreshToken) =>
				if err
					console.error 'Error authorizing OAuth2 endpoint:', JSON.stringify err
					cb err, null
				else
					@loadState {oauthAccessToken, oauthRefreshToken}, (user) ->
						cb 0, user

	loadState: (data, next) ->
		opts = JSON.clone @api.opts
		opts.oauthAccessToken = data.oauthAccessToken
		opts.oauthRefreshToken = data.oauthRefreshToken
		opts.oauthRedirect = @oauthRedirect
		next callable(new OAuth2API @api.manifest, opts)

	startSession: (req, [params]..., cb) ->
		# noop
		@start params, cb

	clearSession: (req, cb) ->
		delete req.session.oauthAccessToken
		delete req.session.oauthRefreshToken
		cb()
	
	loadSession: (req, cb) ->
		@loadState {
			oauthAccessToken: req.session.oauthAccessToken
			oauthRefreshToken: req.session.oauthRefreshToken
		}, (user) ->
			req.user = user
			cb()

	middleware: (cb) ->
		path = new Url(@oauthRedirect).pathname
		return (req, res, next) =>
			if req.path == path
				@complete req.url, (err, user, results) =>
					user.saveSession req, ->
						cb(req, res, next)
			else
				if req.session.oauthAccessToken?
					@loadSession(req, next)
				else
					next()

exports.oauth2 = (api, callback) -> new OAuth2Authentication(api, callback)

# OAuth console
# -------------

exports.oauthConsoleOob = (api, [params]..., cb) ->
	# Out-of-band authentication.
	oauth = rem.oauth(api)
	oauth.start (url, token, secret) ->
		console.log "Visit:", url
		if api.manifest.auth.oobVerifier
			read prompt: "Type in the verification code: ", (err, verifier) ->
				oauth.complete verifier, token, secret, cb
		else
			read prompt: "Hit any key to continue...", (err) ->
				console.log ""
				oauth.complete token, secret, cb 

exports.oauthConsole = (api, [params]..., cb) ->
	# Create OAuth server authentication.
	port = params?.port ? 3000
	oauth = rem.oauth(api, "http://localhost:#{port}/oauth/callback/")
	app = express.createServer()
	app.use express.cookieParser()
	app.use express.session(secret: "!")
	
	# OAuth callback.
	app.use oauth.middleware (req, res, next) ->
		res.send "<h1>Oauthenticated.</h1><p>Return to your console, hero!</p>"
		process.nextTick -> cb 0, req.user
	# Login page.
	app.get '/login/', (req, res) ->
		oauth.startSession req, params or {}, (url) ->
			res.redirect url
	# Listen on server.
	app.listen port
	console.log 'Visit:', "http://localhost:#{port}/login/"
	console.log ""

# AWS Signature
# -------------

class AWSSignatureAPI extends API
	querystring = require('querystring')
	crypto = require('crypto')

	constructor: (manifest, opts) ->
		super

	processRequest: (method, endpointUrl, mime, body, cb) ->
		endpoint = new Url endpointUrl

		# Add a timestamp parameter.
		endpoint.query.Timestamp = new Date().toJSON()
		# Create a signature of query arguments.
		# TODO(tcr) also post arguments...
		hash = crypto.createHmac 'sha256', @opts.secret
		hash.update [
			# Method
			"GET"
			# Value of host header in lowercase
			endpoint.hostname.toLowerCase()
			# HTTP Request URI
			endpoint.pathname
			# Canonical query string (in byte order)
			([k, v] for k, v of endpoint.query)
				.sort(([a], [b]) -> a > b)
				.map(([k, v]) -> querystring.escape(k) + '=' + querystring.escape(v))
				.join('&')
		].join '\n'
		endpoint.query.Signature = hash.digest 'base64'

		# HTTP Request.
		sendHttpRequest method, endpoint.toString(), mime, body, data: cb

exports.aws = (api) -> callable new AWSSignatureAPI api.manifest, api.opts

# Generic console
# ---------------

# TODO more than oauth
exports.console = exports.oauthConsole

# My Console
# ----------

nconf = require 'nconf'
path = require 'path'
osenv = require 'osenv'

exports.myConsole = (name, version, [params]..., cb) ->
	nconf.file path.join(osenv.home(), '.rem.json')

	next = ->
		{key, secret} = nconf.get(name)
		api = rem.load name, version, {key, secret}
		rem.console api, (if params then [params] else [])..., cb

	if nconf.get(name) and nconf.get(name).key and nconf.get(name).secret
		next()
	else
		console.log 'Initializing API keys for ' + name + ' on first use.'
		read prompt: name + ' API key: ', (err, key) ->
			read prompt: name + ' API secret: ', (err, secret) ->
				nconf.set name + ':key', key
				nconf.set name + ':secret', secret
				nconf.save (err) ->
					if err then console.log err
					else next()

# Public API
# ----------

exports.API = API

exports.create = (manifest, opts) -> callable(new API manifest, opts)

# TODO also load locally
exports.load = (name, version = '1', opts) ->
	try
		manifest = JSON.parse(fs.readFileSync __dirname + '/common/' + name + '.json')[version]
	catch e
		throw new Error 'Unable to find API ' + name + '::' + version
	if not manifest? then throw 'Manifest not found'
	return exports.create manifest, opts

exports.url = (url, query = {}) ->
	url = new Url url
	Object.merge url.query, query
	return new Route url, 'form', (method, url, mime, body, cb = null) =>
		sendHttpRequest method, url, mime, body, if cb then {data: cb} else {}
