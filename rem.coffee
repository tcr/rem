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

OAuth2::post = (url, accessToken, body, mime, cb) ->
	@_request "POST", url, {"Content-Type": mime}, body, accessToken, cb

# REM Classes
# -----------

manifests = JSON.parse fs.readFileSync __dirname + '/rem-manifest.json'

class REMAction
	constructor: (@res, @text, fn) ->
		try
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
	key: 'anonymous'
	secret: 'anonymous'

	constructor: (@name, @version = '1') ->
		@manifest = manifests[@name][@version]
		if not @manifest
			throw new Error 'Unable to construct API ' + @name + '::' + @version

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
			args = if @manifest.oauth.version != '2.0' then [@oauthToken, @oauthTokenSecret] else [@oauthToken]
			if method in ['put', 'post']
				payload = [body, mime]
				# Signatures need to be calculated from forms
				if mime == 'application/x-www-form-urlencoded'
					payload = [querystring.parse body]
				@oauth[method] endpointUrl, args..., payload..., fn
			else
				@oauth[method] endpointUrl, args..., fn

		# Standard HTTP request.
		else
			req = (if endpoint.protocol == 'https:' then https else http).request host: endpoint.host, path: endpoint.path, method: method
			req.on 'response', (res) =>
				if res.statusCode in [301, 302, 303] and res.headers['location']
					try
						path = url.parse(res.headers['location'])?.pathname
						#@_request method, path, query, mime, body, fn
					catch e
					return

				text = ''
				unless res.headers['content-type'] or res.headers['content-length'] then fn 0, text, res
				res.on 'data', (d) => text += d
				res.on 'end', => fn 0, text, res

			req.write body if body?
			req.setHeader 'Content-Type', mime if mime?
			req.end()

	get: (path, [query]..., fn) ->
		query ?= {}
		req = @_request 'get', path, query, null, null, (err, data, res) ->
			new REMAction res, data, fn

	post: (path, [query]..., data, fn) ->
		query ?= {}
		if @manifest.postType == 'form'
			payload = ['application/x-www-form-urlencoded', querystring.stringify(data)]
		else
			payload = ['application/json', safeJSONStringify(data)]

		req = @_request 'post', path, query, payload..., (err, data, res) ->
			new REMAction res, data, fn

	put: (path, [query]..., mime, data, fn) ->
		query ?= {}
		req = @_request 'put', path, query, mime, data, (err, data, res) ->
			new REMAction res, data, fn

	delete: (path, [query]..., fn) ->
		query ?= {}
		req = @_request 'delete', path, query, (err, data, res) ->
			new REMAction res, data, fn

	# OAuth
	# -----

	oauth: null

	# OAuth2
	oauthRedirectUri: null
	oauthToken: null
	oauthTokenSecret: null

	startOAuthCallback: (@oauthRedirectUri, cb) ->
		if @manifest.oauth.version != '2.0'
			@oauth = new OAuth @manifest.oauth.requestEndpoint, @manifest.oauth.accessEndpoint,
				@key, @secret, @manifest.oauth.version or '1.0', @oauthRedirectUri, "HMAC-SHA1"
			@oauth.getOAuthRequestToken (@manifest.oauth.props or {}), (err, @oauthToken, @oauthTokenSecret, results) =>
				if err
					console.log "Error requesting OAuth token: " + JSON.stringify(err)
				else
					cb "#{@manifest.oauth.authorizeEndpoint}?oauth_token=#{oauthToken}", results

		else
			@oauth = new OAuth2 @key, @secret, @manifest.oauth.base
			cb @oauth.getAuthorizeUrl(redirect_uri: @oauthRedirectUri, scope: "email,read_stream,publish_stream", display: "page")

	startOAuth: (cb) -> @startOAuthCallback @manifest.oauth.emptyCallback or `undefined`, cb

	completeOAuthCallback: (originalUrl, cb) ->
		if @manifest.oauth.version != '2.0'

		else
			parsedUrl = url.parse originalUrl, yes
			@oauth.getOAuthAccessToken parsedUrl.query?.code, redirect_uri: @oauthRedirectUri, (err, @oauthToken, @oauthRefreshToken) =>
				if err
					console.log 'Error authorizing OAuth2 endpoint:', JSON.stringify err
				else
					cb()

	completeOAuth: ([verifier]..., cb) ->
		@oauth.getOAuthAccessToken @oauthToken, @oauthTokenSecret, verifier, (err, @oauthToken, @oauthTokenSecret, results) =>
			if err
				console.log "Error authorizing OAuth endpoint: " + JSON.stringify(err)
			else
				cb results

module.exports = REM