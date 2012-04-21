###

REM: Remedial Rest Interfaces

http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven

A library that simplifies and normalizes access to REST APIs.

###

querystring = require 'querystring'
https = require 'https'
http = require 'http'
util = require 'util'
fs = require 'fs'
# Conditional requires.
libxmljs = null

# Config
USER_AGENT = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://rem.tcr.io/)'

# Lib functions
# -------------

Object.merge = (base, args...) ->
	for arg in args
		for k, v of arg then base[k] = v
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
					request method, res.headers['location'], mime, body, opts
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
	constructor: (@res, @text) ->
		@statusCode = Number(@res.statusCode)
		@errorCode = if @statusCode > 400 then @statusCode else 0
		
		# Parse body
		try
			if @res.headers['content-type'].replace(/\s+|;.*/g, '') in ['text/xml', 'application/xml', 'application/atom+xml']
				@type = 'xml'
				@data = @xml = (libxmljs ?= require('libxmljs')).parseXmlString @text

			else
				@type = 'json'
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

# format
# uploadFormat
# basepath
# suffix
# params
# configParams
# auth: {type, opts...}

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
		@auth = new authtypes[@manifest.auth?.type ? 'unauthenticated'] this, @manifest.auth

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
				@auth.processRequest method, endpoint.toString(), mime, body, (err, data, res) ->
					# User callbacks.
					return unless cb
					if err
						cb(err, null, null)
					else
						media = new HyperMedia res, data
						cb media.errorCode, media.data, media

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

authtypes = {}

class authtypes.unauthenticated
	constructor: (@api, opts) ->

	processRequest: (method, endpointUrl, mime, body, cb) ->
		sendHttpRequest method, endpointUrl, mime, body, data: cb

# Cookie Session Auth
# -------------------

{Cookie, CookieJar} = require 'tough-cookie'

# array of cookies to track

class CookieAuthentication
	constructor: (@api, @opts) ->
		@isAuthenticated = no
		# Create cookie jar.
		@jar = new CookieJar()
		# Get list of hosts from manifest.
		@hosts = []
		for v in [if typeof @api.manifest.base == 'string' then [/^.*$/, @api.manifest.base] else @api.manifest.base]
			url = new Url(if typeof v == 'object' then v[1] else v)
			@hosts.push url.protocol + '//' + url.hostname

	processRequest: (method, endpointUrl, mime, body, cb) ->
		# HTTP Request.
		sendHttpRequest method, endpointUrl, mime, body,
			headers: (req, next) =>
				@jar.getCookieString endpointUrl, (err, cookies) =>
					req.setHeader 'Cookie', cookies
					next()

			data: (err, data, res) =>
				# Read cookies.
				if res.headers['set-cookie'] instanceof Array
					cookies = res.headers['set-cookie'].map Cookie.parse
				else if res.headers['set-cookie']?
					cookies = [Cookie.parse(res.headers['set-cookie'])]
				for cookie in (cookies or []) when cookie.key in @opts.cookies
					@jar.setCookie cookie, endpointUrl, (err, r) ->
						@isAuthenticated = yes
						console.error err if err

				# Continue.
				cb err, data, res

	loadState: (data, next) ->
		for host of (data.cookies or {})
			for cookie in data.cookies[host]
				@jar.setCookie cookie, host, (err) ->
					console.error err if err
		next?()

	saveState: (next) ->
		i = @hosts.length
		cookies = {}
		for host in @hosts
			do (host) =>
				@jar.getCookies host, (err, hostCookies) =>
					cookies[host] = hostCookies.map String
					if --i == 0
						next {cookies}

authtypes.cookies = CookieAuthentication

# OAuth
# -----

nodeoauth = require("oauth")

# version = '1.0', '1.0a'
# requestEndpoint
# accessEndpoint
# opts
# scopeSeparator
# emptyCallback
# oobVerifier
# validate

class OAuth1Authentication
	constructor: (@api, @opts) ->
		@isAuthenticated = no
		@oauth = new nodeoauth.OAuth @opts.requestEndpoint, @opts.accessEndpoint,
			@api.key, @api.secret, opts.version or '1.0', @oauthRedirectUri, "HMAC-SHA1", null,
			{'User-Agent': USER_AGENT, "Accept": "*/*", "Connection": "close", "User-Agent": "Node authentication"}

	processRequest: (method, endpointUrl, mime, body, cb) ->
		# OAuth request.
		payload = if method in ['put', 'post']
			# Signatures need to be calculated from forms; let node-oauth do that
			if mime == 'application/x-www-form-urlencoded' then [querystring.parse body]
			else [body, mime]
		else []
		return @oauth[method] endpointUrl, @oauthToken, @oauthTokenSecret, payload..., cb

	# State.
	oauthRedirectUri: null
	oauthToken: null
	oauthTokenSecret: null

	loadState: (data, next = null) ->
		{@oauthToken, @oauthTokenSecret, @oauthRedirectUri} = data
		next?()

	saveState: (next) ->
		next {
			@oauthRedirectUri
			@oauthToken
			@oauthTokenSecret
		}

	startCallback: (oauthRedirectUri, [params]..., cb) ->
		@oauthRedirectUri = oauthRedirectUri
		params = Object.merge (params or {}), (@opts.params or {})
		if params.scope? and typeof params.scope == 'object'
			params.scope = params.scope.join(@opts.scopeSeparator or ' ')
		# Needed for Twitter, etc.
		if oauthRedirectUri? then params['oauth_callback'] = oauthRedirectUri

		@oauth.getOAuthRequestToken params, (err, @oauthToken, @oauthTokenSecret, results) =>
			if err
				console.error "Error requesting OAuth token: " + JSON.stringify(err)
			else
				authurl = new Url(@opts.authorizeEndpoint)
				authurl.query.oauth_token = oauthToken
				if oauthRedirectUri? then authurl.query.oauth_callback = oauthRedirectUri
				cb authurl.toString(), results

	start: (cb) ->
		if not @opts.oob
			console.error 'Out-of-band OAuth for this API is not permitted.'
			return
		@startCallback @opts.oobCallback or `undefined`, cb

	completeCallback: (originalUrl, cb) ->
		@complete new Url(originalUrl).query.oauth_verifier, cb

	complete: ([verifier]..., cb) ->
		if not verifier? and @opts.oobVerifier
			console.error 'Out-of-band OAuth for this API requires a verification code.'
			return

		@oauth.getOAuthAccessToken @oauthToken, @oauthTokenSecret, verifier, (err, @oauthToken, @oauthTokenSecret, results) =>
			if err
				console.error "Error authorizing OAuth endpoint: " + JSON.stringify(err)
				cb err
			else
				@isAuthenticated = yes
				cb err, results

	validate: (cb) ->
		if not @opts.validate
			throw new Error 'Manifest does not define mechanism for validating OAuth.'
		@api(@opts.validate).get (err, data) ->
			console.error err, data
			cb err

	middleware: (url, cb) ->
		path = new Url(url).pathname
		return (req, res, next) =>
			unless req.path == path then next()
			else @completeCallback req.url, (results) -> cb req, res, next

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

# version
# base
# scopeSeparator
# emptyCallback
# validate

class OAuth2Authentication
	constructor: (@api, @opts) ->
		@isAuthenticated = no
		@oauth = new nodeoauth.OAuth2 @api.key, @api.secret, @opts.base

	processRequest: (method, endpointUrl, mime, body, cb) ->
		payload = if method in ['put', 'post'] then [body, mime] else []
		return @oauth[method] endpointUrl, @oauthToken, payload..., cb

	# state
	oauthRedirectUri: null
	oauthToken: null

	loadState: (data, next = null) ->
		{@oauthToken, @oauthRedirectUri} = data
		next?()

	saveState: (next) ->
		next {
			@oauthRedirectUri
			@oauthToken
		}

	startCallback: (oauthRedirectUri, [params]..., cb) ->
		@oauthRedirectUri = oauthRedirectUri
		params = Object.merge (params or {}), (@opts.params or {})
		if params.scope? and typeof params.scope == 'object'
			params.scope = params.scope.join(@opts.scopeSeparator or ' ')

		params.redirect_uri = @oauthRedirectUri
		cb @oauth.getAuthorizeUrl(params)

	start: (cb) -> @startCallback @opts.emptyCallback or `undefined`, cb

	completeCallback: (originalUrl, cb) ->
		@oauth.getOAuthAccessToken new Url(originalUrl).query.code, redirect_uri: @oauthRedirectUri, (err, @oauthToken, @oauthRefreshToken) =>
			if err
				console.error 'Error authorizing OAuth2 endpoint:', JSON.stringify err
				cb err
			else
				@isAuthenticated = yes
				cb 0

	complete: ([verifier]..., cb) -> ### TODO(tcr) ###

	validate: (cb) ->
		if not @opts.validate
			throw new Error 'Manifest does not define mechanism for validating OAuth.'
		@api(@opts.validate).get (err, data) ->
			console.error err, data
			cb err

	middleware: (url, cb) ->
		path = new Url(url).pathname
		return (req, res, next) =>
			unless req.path == path then next()
			else @completeCallback req.url, (results) -> cb req, res, next

authtypes.oauth = (api, opts) ->
	switch String(opts.version ? '1.0').toLowerCase()
		when '1.0', '1.0a' then new OAuth1Authentication(api, opts)
		when '2.0' then new OAuth2Authentication(api, opts)
		else throw new Error 'Invalid OAuth version ' + opts.version

# AWS Custom Authentication.

class AWSSignatureAuthentication
	querystring = require('querystring')
	crypto = require('crypto')

	constructor: (@api, @opts) ->

	processRequest: (method, endpointUrl, mime, body, cb) ->
		endpoint = new Url endpointUrl

		# Add a timestamp parameter.
		endpoint.query.Timestamp = new Date().toJSON()
		# Create a signature of query arguments.
		# TODO(tcr) also post arguments...
		hash = crypto.createHmac 'sha256', @api.opts.secret
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

authtypes.awsSignature = AWSSignatureAuthentication

# Public API
# ----------

exports.API = API

exports.create = (manifest, opts) ->
	f = (args...) -> f.call args...
	f.__proto__ = new API manifest, opts
	return f

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
