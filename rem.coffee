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
url = require 'url'
fs = require 'fs'
robots = require './robotstxt'
libxmljs = require 'libxmljs'
mime = require 'mime'
{Cookie, CookieJar} = require 'tough-cookie'

USER_AGENT = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://rem.tcr.io/)'

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

# REM Classes
# -----------

manifests = JSON.parse fs.readFileSync __dirname + '/rem-manifest.json'

class REMAction
	constructor: (@res, @text, fn) ->
		try
			if @res.headers['content-type'].replace(/\s+|;.*/g, '') in ['text/xml', 'application/xml', 'application/atom+xml']
				@type = 'xml'
				@xml = libxmljs.parseXmlString @text

			else
				@type = 'json'
				@json = JSON.parse @text
				@parseRate()
				@parseHrefs()

			@statusCode = Number(@res.statusCode)
			if @statusCode >= 400 then fn(@statusCode, this)
			else fn(0, this)
		catch e
			fn(e, this)
	
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

class REM
	getHost = (hosturl) ->
		try
			hosturl = url.parse(hosturl)
			return "#{hosturl.protocol}//#{hosturl.host}"
		catch e
			return null

	constructor: (@name, @version = '1', @opts) ->
		@manifest = manifests[@name][@version]
		if not @manifest
			throw new Error 'Unable to construct API ' + @name + '::' + @version

		# Load key, secret
		{@key, @secret} = @opts

		# OAuth.
		if 'oauth' of (@manifest.auth or {})
			if @manifest.auth.oauth.version != '2.0'
				@oauth = new OAuth @manifest.auth.oauth.requestEndpoint, @manifest.auth.oauth.accessEndpoint,
					@key, @secret, @manifest.auth.oauth.version or '1.0', @oauthRedirectUri, "HMAC-SHA1", null,
					{'User-Agent': USER_AGENT, "Accept": "*/*", "Connection": "close", "User-Agent": "Node authentication"}
			else
				@oauth = new OAuth2 @key, @secret, @manifest.auth.oauth.base
		# Create cookie jar.
		if 'session' of @manifest.auth or {}
			@cookies = new CookieJar()

		# Add filter methods
		@filters = []
		if @manifest.basepath?
			@filters.push (endpoint) => endpoint.pathname = @manifest.basepath + endpoint.pathname
		if @manifest.suffix?
			@filters.push (endpoint) => endpoint.pathname += @manifest.suffix
		if @manifest.keyAsParam?
			@filters.push (endpoint) => endpoint.query[@manifest.keyAsParam] = @key
		if @manifest.params?
			@filters.push (endpoint) =>
				for qk, qv of @manifest.params then endpoint.query[qk] = qv

		# Get list of hosts from manifest.
		if typeof @manifest.base == 'object'
			@hosts = for v in @manifest.base
				getHost if typeof v == 'object' then v[1] else v
		else 
			@hosts = [getHost @manifest.base]
		# Initialize robots.txt crawlers.
		@gatekeepers = {}
		if @manifest.robotsTxt
			for host in @hosts
				do (host) =>
					txt = robots "#{host}/robots.txt", USER_AGENT
					txt.on 'error', (err) -> # ignore
					txt.on 'ready', (gatekeeper) =>
						@gatekeepers[host] = gatekeeper

	_request: (method, path, query, mime, body, fn) ->
		# Normalize path.
		if path[0] != '/'
			path = '/' + path
		# Determine host.
		if typeof @manifest.base == 'string'
			base = @manifest.base
		else
			base = ''
			for pat in @manifest.base
				if typeof pat == 'string'
					base = pat
					break
				if path.match new RegExp(pat[0])
					base = pat[1]
					break

		# Check robots.txt gatekeepers.
		if @gatekeepers[getHost base]?.isDisallowed path
			fn {error: 'Robots.txt disallows this path', reason: @gatekeepers[getHost base]?.why path}, null, null
			return

		# Construct endpoint path.
		endpoint = url.parse base + path
		endpoint.query = {}
		for qk, qv of query
			endpoint.query[qk] = qv
		for filter in @filters
			filter endpoint
		# Normalize endpoint.
		endpointUrl = url.format endpoint
		endpoint = url.parse endpointUrl

		# OAuth request.
		if @oauth
			args = if @manifest.auth.oauth.version != '2.0' then [@oauthToken, @oauthTokenSecret] else [@oauthToken]
			if method in ['put', 'post']
				payload = [body, mime]
				# Signatures need to be calculated from forms
				if @manifest.auth.oauth.version != '2.0' and mime == 'application/x-www-form-urlencoded'
					payload = [querystring.parse body]
				@oauth[method] endpointUrl, args..., payload..., fn
			else
				@oauth[method] endpointUrl, args..., fn

		# Standard HTTP request.
		else
			req = (if endpoint.protocol == 'https:' then https else http).request host: endpoint.host, path: endpoint.path, method: method
			req.on 'response', (res) =>
				# Attempt to follow Location: headers.
				if res.statusCode in [301, 302, 303] and res.headers['location']
					try
						path = url.parse(res.headers['location'])?.pathname
						@_request method, path, query, mime, body, fn
					catch e
					return

				# Read cookies.
				if res.headers['set-cookie'] instanceof Array
					cookies = res.headers['set-cookie'].map Cookie.parse
				else if res.headers['set-cookie']?
					cookies = [Cookie.parse(res.headers['set-cookie'])]
				for cookie in (cookies or []) when cookie.key in (@manifest.auth?.session?.cookies or [])
					@cookies.setCookie cookie, endpointUrl, (err, r) ->
						console.error err if err

				# Read content.
				text = ''
				unless res.headers['content-type'] or res.headers['content-length'] then fn 0, text, res
				res.on 'data', (d) => text += d
				res.on 'end', => fn 0, text, res

			req.setHeader 'User-Agent', USER_AGENT
			req.setHeader 'Content-Type', mime if mime?
			req.setHeader 'Content-Length', body.length if body?
			@cookies.getCookieString endpointUrl, (err, cookies) =>
				req.setHeader 'Cookie', cookies
				req.write body if body?
				req.end()

	get: (path, [query]..., fn) ->
		query ?= {}
		req = @_request 'get', path, query, null, null, (err, data, res) ->
			if err then fn(err, null)
			else new REMAction res, data, fn

	post: (path, [query]..., data, fn) ->
		query ?= {}
		if @manifest.postType == 'form'
			payload = ['application/x-www-form-urlencoded', querystring.stringify(data)]
		else
			payload = ['application/json', safeJSONStringify(data)]

		req = @_request 'post', path, query, payload..., (err, data, res) ->
			if err then fn(err, null)
			else new REMAction res, data, fn

	put: (path, [query]..., mime, data, fn) ->
		query ?= {}
		req = @_request 'put', path, query, mime, data, (err, data, res) ->
			if err then fn(err, null)
			else new REMAction res, data, fn

	delete: (path, [query]..., fn) ->
		query ?= {}
		req = @_request 'delete', path, query, (err, data, res) ->
			if err then fn(err, null)
			else new REMAction res, data, fn

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

	startOAuthCallback: (@oauthRedirectUri, [params]..., cb) ->
		params ?= {}
		for k, v of @manifest.auth.oauth.params
			unless params[k]? then params[k] = v
		if params.scope? and typeof params.scope == 'object'
			params.scope = params.scope.join(@manifest.auth.oauth.scopeSeparator or ' ')

		if @manifest.auth.oauth.version != '2.0'
			@oauth.getOAuthRequestToken params, (err, @oauthToken, @oauthTokenSecret, results) =>
				if err
					console.error "Error requesting OAuth token: " + JSON.stringify(err)
				else
					cb "#{@manifest.auth.oauth.authorizeEndpoint}?oauth_token=#{oauthToken}", results

		else
			params.redirect_uri = @oauthRedirectUri
			cb @oauth.getAuthorizeUrl(params)

	startOAuth: (cb) -> @startOAuthCallback @manifest.auth.oauth.emptyCallback or `undefined`, cb

	completeOAuthCallback: (originalUrl, cb) ->
		if @manifest.auth.oauth.version != '2.0'

		else
			parsedUrl = url.parse originalUrl, yes
			@oauth.getOAuthAccessToken parsedUrl.query?.code, redirect_uri: @oauthRedirectUri, (err, @oauthToken, @oauthRefreshToken) =>
				if err
					console.error 'Error authorizing OAuth2 endpoint:', JSON.stringify err
				else
					cb()

	completeOAuth: ([verifier]..., cb) ->
		if not verifier? and @manifest.auth.oauth.oobVerifier
			console.error 'Out-of-band OAuth for this API requires a verification code.'
			return

		@oauth.getOAuthAccessToken @oauthToken, @oauthTokenSecret, verifier, (err, @oauthToken, @oauthTokenSecret, results) =>
			if err
				console.error "Error authorizing OAuth endpoint: " + JSON.stringify(err)
			else
				cb results

	validateOAuth: (cb) ->
		if not @manifest.auth.oauth.validate
			throw new Error 'Manifest does not define mechanism for validating OAuth.'
		@get @manifest.auth.oauth.validate, (err, data) ->
			console.error err, data
			cb err

	oauthMiddleware: (path, cb) ->
		return (req, res, next) =>
			if req.path == path
				@completeOAuthCallback req.url, cb
				res.send 'OAuth2 verified.'
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
		if data.oauth
			@validateOAuth cb if cb

module.exports = REM