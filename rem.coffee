###

REM: Remedial Rest Interfaces

http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven

A library that simplifies and normalizes access to REST APIs.

###

querystring = require 'querystring'
https = require 'https'
http = require 'http'
{OAuth, OAuth2} = require("oauth")
util = require 'util'
fs = require 'fs'
{Cookie, CookieJar} = require 'tough-cookie'

# Conditional requires.
libxmljs = null

USER_AGENT = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://rem.tcr.io/)'

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

# Lib functions
# -------------

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

#oldreq = OAuth2::_request
#OAuth2::_request = (method, url, headers, body, accessToken, cb) ->
#	header['User-Agent'] = USER_AGENT
#	oldreq.call this, method, url, headers, body, accessToken, cb
#OAuth2::get = (url, accessToken, body, mime, cb) ->
#	@_request "GET", url, {}, "", accessToken, cb
OAuth2::post = (url, accessToken, body, mime, cb) ->
	@_request "POST", url, {"Content-Type": mime}, body, accessToken, cb
OAuth2::put = (url, accessToken, body, mime, cb) ->
	@_request "PUT", url, {"Content-Type": mime}, body, accessToken, cb
OAuth2::delete = (url, accessToken, body, mime, cb) ->
	@_request "DELETE", url, {}, "", accessToken, cb

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

class REMAction
	constructor: (@res, @text, fn) ->
		@statusCode = Number(@res.statusCode)
		try
			if @res.headers['content-type'].replace(/\s+|;.*/g, '') in ['text/xml', 'application/xml', 'application/atom+xml']
				@type = 'xml'
				@data = @xml = (libxmljs ?= require('libxmljs')).parseXmlString @text

			else
				@type = 'json'
				@data = @json = JSON.parse @text
				@parseRate()
				@parseHrefs()

			if @statusCode >= 400 then fn(@statusCode, @data, this)
			else fn(0, @data, this)
		catch e
			if @statusCode >= 400 then fn(@statusCode, @data, this)
			else fn(e, @data, this)
	
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

# Route for a given path or URL.

class Route
	constructor: (@url, @defaultBodyMime = 'form', @send) ->

	get: ([query]..., fn) ->
		url = @url.clone()
		Object.merge url.query, (query or {})
		return @send 'get', url.toString(), null, null, data: fn

	head: ([query]..., fn) ->
		url = @url.clone()
		Object.merge url.query, (query or {})
		return @send 'head', url.toString(), null, null, data: fn

	post: ([mime]..., data, fn) ->
		mime ?= @defaultBodyMime
		payload = switch mime
			when 'form' then ['application/x-www-form-urlencoded', querystring.stringify(data)]
			when 'json' then ['application/json', safeJSONStringify(data)]
			else [mime, data]
		return @send 'post', @url.toString(), payload..., data: fn

	put: ([mime]..., data, fn) ->
		mime ?= @defaultBodyMime
		payload = switch mime
			when 'form' then ['application/x-www-form-urlencoded', querystring.stringify(data)]
			when 'json' then ['application/json', safeJSONStringify(data)]
			else [mime, data]
		return @send 'put', @url.toString(), payload..., data: fn

	delete: (fn) ->
		return @send 'delete', @url.toString(), null, null, data: fn

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

		# OAuth.
		if 'oauth' of (@manifest.auth or {})
			if @manifest.auth.oauth.version != '2.0'
				@oauth = new OAuth @manifest.auth.oauth.requestEndpoint, @manifest.auth.oauth.accessEndpoint,
					@key, @secret, @manifest.auth.oauth.version or '1.0', @oauthRedirectUri, "HMAC-SHA1", null,
					{'User-Agent': USER_AGENT, "Accept": "*/*", "Connection": "close", "User-Agent": "Node authentication"}
			else
				@oauth = new OAuth2 @key, @secret, @manifest.auth.oauth.base
		# Create cookie jar.
		#if 'session' of (@manifest.auth or {})
		@cookies = new CookieJar()

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

		# Get list of hosts from manifest.
		@hosts = []
		for v in [if typeof @manifest.base == 'string' then [/^.*$/, @manifest.base] else @manifest.base]
			url = new Url(if typeof v == 'object' then v[1] else v)
			@hosts.push url.protocol + '//' + url.hostname

	call: (pathname, query) ->
		url = new Url('')
		url.pathname = pathname
		url.query = query

		# Return a new route with data preparation.
		return new Route url, @manifest.uploadFormat, (method, path, mime, body, handlers = {}) =>
			datahandler = (err, data, res) ->
				if err then handlers.data(err, null)
				else new REMAction res, data, handlers.data

			# Normalize path.
			if path[0] != '/'
				path = '/' + path
			# path host.
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

			# Construct endpoint path.
			endpoint = new Url base
			endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + path
			for filter in @filters
				filter endpoint

			if @oauth
				# OAuth request.
				args = if @manifest.auth.oauth.version != '2.0' then [@oauthToken, @oauthTokenSecret] else [@oauthToken]
				if method in ['put', 'post']
					payload = [body, mime]
					# Signatures need to be calculated from forms
					if @manifest.auth.oauth.version != '2.0' and mime == 'application/x-www-form-urlencoded'
						payload = [querystring.parse body]
					return @oauth[method] endpoint.toString(), args..., payload..., datahandler
				else
					return @oauth[method] endpoint.toString(), args..., datahandler

			else
				# HTTP Request.
				sendHttpRequest method, endpoint.toString(), mime, body,
					headers: (req, next) =>
						@cookies.getCookieString endpoint.toString(), (err, cookies) =>
							req.setHeader 'Cookie', cookies
							next()

					data: (err, data, res) =>
						# Read cookies.
						if res.headers['set-cookie'] instanceof Array
							cookies = res.headers['set-cookie'].map Cookie.parse
						else if res.headers['set-cookie']?
							cookies = [Cookie.parse(res.headers['set-cookie'])]
						for cookie in (cookies or []) when cookie.key in (@manifest.auth?.session?.cookies or [])
							@cookies.setCookie cookie, endpoint.toString(), (err, r) ->
								console.error err if err

						# Continue.
						datahandler err, data, res

	# Root request shorthand
	# ----------------------

	get: (args...) -> @('').get args...
	post: (args...) -> @('').post args...
	delete: (args...) -> @('').delete args...
	head: (args...) -> @('').head args...
	put: (args...) -> @('').put args...
	patch: (args...) -> @('').patch args...

	# Session-based Auth
	# ------------------

	cookies: null

	# OAuth
	# -----

	oauth: null

	# OAuth2
	oauthRedirectUri: null
	oauthToken: null
	oauthTokenSecret: null

	startOAuthCallback: (oauthRedirectUri, [params]..., cb) ->
		@oauthRedirectUri = oauthRedirectUri
		params ?= {}
		for k, v of @manifest.auth.oauth.params
			unless params[k]? then params[k] = v
		if params.scope? and typeof params.scope == 'object'
			params.scope = params.scope.join(@manifest.auth.oauth.scopeSeparator or ' ')
		# Needed for Twitter, etc.
		params['oauth_callback'] = oauthRedirectUri

		if @manifest.auth.oauth.version != '2.0'
			@oauth.getOAuthRequestToken params, (err, @oauthToken, @oauthTokenSecret, results) =>
				if err
					console.error "Error requesting OAuth token: " + JSON.stringify(err)
				else
					cb "#{@manifest.auth.oauth.authorizeEndpoint}?oauth_callback=#{oauthRedirectUri}&oauth_token=#{oauthToken}", results

		else
			params.redirect_uri = @oauthRedirectUri
			cb @oauth.getAuthorizeUrl(params)

	startOAuth: (cb) -> @startOAuthCallback @manifest.auth.oauth.emptyCallback or `undefined`, cb

	completeOAuthCallback: (originalUrl, cb) ->
		if @manifest.auth.oauth.version != '2.0'
			@completeOAuth new Url(originalUrl).query.oauth_verifier, cb

		else
			@oauth.getOAuthAccessToken new Url(originalUrl).query.code, redirect_uri: @oauthRedirectUri, (err, @oauthToken, @oauthRefreshToken) =>
				if err
					console.error 'Error authorizing OAuth2 endpoint:', JSON.stringify err
					cb err
				else
					cb 0

	completeOAuth: ([verifier]..., cb) ->
		if not verifier? and @manifest.auth.oauth.oobVerifier
			console.error 'Out-of-band OAuth for this API requires a verification code.'
			return

		@oauth.getOAuthAccessToken @oauthToken, @oauthTokenSecret, verifier, (err, @oauthToken, @oauthTokenSecret, results) =>
			if err
				console.error "Error authorizing OAuth endpoint: " + JSON.stringify(err)
				cb err
			else
				cb err, results

	validateOAuth: (cb) ->
		if not @manifest.auth.oauth.validate
			throw new Error 'Manifest does not define mechanism for validating OAuth.'
		@request 'get', @manifest.auth.oauth.validate, {}, null, null, (err, data) ->
			console.error err, data
			cb err

	oauthMiddleware: (path, cb) ->
		return (req, res, next) =>
			if req.path == path
				@completeOAuthCallback req.url, (results) ->
					cb req, res, next
			else
				next()

	# Save/restore state.

	saveState: (cb) ->
		i = @hosts.length
		cookieMap = {}
		for host in @hosts
			do (host) =>
				@cookies.getCookies host, (err, cookies) =>
					cookieMap[host] = cookies.map String
					if --i == 0
						cb {
							oauth: @oauth?
							@oauthToken
							@oauthTokenSecret
							@oauthRedirectUri
							cookies: cookieMap
						}

	loadState: (data, cb = null) ->
		{@oauthToken, @oauthTokenSecret, @oauthRedirectUri} = data
		for host of (data.cookies or {})
			for cookie in data.cookies[host]
				@cookies.setCookie cookie, host, (err) ->
					console.error err if err
		cb() if cb

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
	return new Route url, 'form', sendHttpRequest
