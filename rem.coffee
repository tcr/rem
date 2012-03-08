###

REM: Remedial Rest Interfaces

http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven

A library that simplifies and normalizes access to REST APIs.

###

querystring = require 'querystring'
https = require 'https'
http = require 'http'
OAuth = require("oauth").OAuth
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

# REM Classes
# -----------

manifests = JSON.parse fs.readFileSync 'rem-manifest.json'

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
			fn(e, null)
	
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
		if @manifest.withKey?
			switch @manifest.withKey.type
				when 'query'
					@filters.push (endpoint) => endpoint.query[@manifest.withKey.name] = @key
		if @manifest.params?
			@filters.push (endpoint) =>
				for qk, qv of @manifest.params then endpoint.query[qk] = qv

	_request: (method, path, query, mime, body, fn) ->
		# Determine host.
		if typeof @manifest.host == 'string'
			host = @manifest.host
		else
			host = ''
			for pat in @manifest.host
				if typeof pat == 'string'
					host = pat
					break
				if path.match new RegExp(pat[0])
					host = pat[1]
					break

		# Construct endpoint path.
		endpoint = 
			host: host
			protocol: @manifest.protocols[0]
			pathname: path
			query: query or {}
		for filter in @filters
			filter endpoint
		# Normalize endpoint.
		endpointUrl = url.format endpoint
		endpoint = url.parse endpointUrl

		# Oauth request.
		if @oauth
			if method in ['put', 'post']
				@oauth[method] endpointUrl, @oauthToken, @oauthTokenSecret, body, mime, fn
			else
				@oauth[method] endpointUrl, @oauthToken, @oauthTokenSecret, fn
		# Standard HTTP request.
		else
			req = (if @manifest.protocols[0] == 'https' then https else http).request host: endpoint.host, path: endpoint.path, method: method
			req.on 'response', (res) =>
				text = ''
				unless res.headers['content-type'] or @res.headers['content-length'] then fn 0, text, res
				res.on 'data', (d) => text += d
				res.on 'end', => fn 0, text, res

			req.write body if body?
			req.setHeader 'Content-Type', mime if mime?
			req.end()

	get: (path, query, fn) ->
		req = @_request 'get', path, query, null, null, (err, data, res) ->
			new REMAction res, data, fn

	post: (path, query, data, fn) ->
		req = @_request 'post', path, query, 'application/json', safeJSONStringify(data), (err, data, res) ->
			new REMAction res, data, fn

	put: (path, query, mime, data, fn) ->
		req = @_request 'put', path, query, mime, data, (err, data, res) ->
			new REMAction res, data, fn

	delete: (path, query, fn) ->
		req = @_request 'delete', path, query, (err, data, res) ->
			new REMAction res, data, fn

	# OAuth
	# -----

	oauth: null

	performOAuth: (authcb, finalcb) ->
		cburl = @manifest.oauth.emptyCallback or `undefined`
		@oauth = new OAuth @manifest.oauth.requestEndpoint, @manifest.oauth.accessEndpoint,
			@key, @secret, @manifest.oauth.version or '1.0', cburl, "HMAC-SHA1"
		@oauth.getOAuthRequestToken (@manifest.oauth.props or {}), (err, oauthToken, oauthTokenSecret, results) =>
			if err
				console.log "Error requesting OAuth token: " + JSON.stringify(err)
			else
				authcb "#{@manifest.oauth.authorizeEndpoint}?oauth_token=#{oauthToken}", results, (data) =>
					@oauth.getOAuthAccessToken oauthToken, oauthTokenSecret, data, (err, @oauthToken, @oauthTokenSecret, results) =>
						if err
							console.log "Error authorizing OAuth endpoint: " + JSON.stringify(err)
						else
							finalcb results

module.exports = REM