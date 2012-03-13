document.write "<script type='text/javascript' src='../lib/oauth.js'></script>"
document.write "<script type='text/javascript' src='../lib/sha1.js'></script>"
document.write "<script type='text/javascript' src='../lib/jsonp.js'></script>"
document.write "<script type='text/javascript' src='../lib/store.min.js'></script>"

manifests = {
  "dropbox": {
    "1": {
      "name": "Dropbox",
      "docs": "https://www.dropbox.com/developers",

      "base": [
        ["^/(files(_put)?|thumbnails)/.*", "https://api-content.dropbox.com/1"],
        "https://api.dropbox.com/1"
      ],

      "auth": {
        "oauth": {
          "version": "1.0",
          "requestEndpoint": "https://api.dropbox.com/1/oauth/request_token",
          "accessEndpoint": "https://api.dropbox.com/1/oauth/access_token",
          "authorizeEndpoint": "https://www.dropbox.com/1/oauth/authorize",
          "validate": "/account/info",
          "oob": true,
          "oobVerifier": false
        }
      }
    }
  },

  "twitter": {
    "1": {
      "name": "Twitter",
      "docs": "https://dev.twitter.com/docs",

      "base": [["^/search", "https://search.twitter.com"], "https://api.twitter.com/1"],
      "postType": "form",

      "suffix": ".json",

      "auth": {
        "oauth": {
          "version": "1.0",
          "requestEndpoint": "https://api.twitter.com/oauth/request_token",
          "accessEndpoint": "https://api.twitter.com/oauth/access_token",
          "authorizeEndpoint": "https://api.twitter.com/oauth/authorize",
          "emptyCallback": "oob",
          "validate": "/account/verify_credentials",
          "oob": true
        }
      }
    }
  }
}

querystring =
	parse: (str) ->
		obj = {}
		for pair in str.split("&")
			[k, v] = pair.split("=")
			obj[k] = v
		return obj

	stringify: (obj) ->
		str = ""
		for k, v of obj
			str += k + '=' + v + '&'
		return str

this.REM = class REM
	@_counter = 0

	getHost = (hosturl) ->
		try
			return hosturl.match(/^https?:\/\/[^\/]+/)?[0]
			#hosturl = url.parse(hosturl)
			#return "#{hosturl.protocol}//#{hosturl.host}"
		catch e
			return null

	constructor: (@name, @version = '1', @opts) ->
		@manifest = manifests[@name][@version]
		if not @manifest
			throw new Error 'Unable to construct API ' + @name + '::' + @version

		# Load key, secret
		{@key, @secret} = @opts

		# OAuth.
		for k in ['requestToken', 'requestTokenSecret', 'accessToken', 'accessTokenSecret'] when store.get("#{@id}-#{k}")?
			@[k] = store.get("#{@id}-#{k}")

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

	_createOAuthRequest: (param1, param2) ->
		param1.token ?= @accessToken
		param1.tokenSecret ?= @accessTokenSecret
		accessor = consumerSecret: @secret
		message =
			action: param1.url
			method: 'GET'
			parameters: [["oauth_consumer_key", @key], ["oauth_signature_method", "HMAC-SHA1"]]

		message.parameters.push ["oauth_token", param1.token] unless param1.token is true
		accessor.tokenSecret = param1.tokenSecret  unless param1.tokenSecret is true
		for i of param2
			message.parameters.push param2[i]
		message.parameters.push ["callback", JSONP.getNextCallback()]
		OAuth.setTimestampAndNonce message
		OAuth.SignatureMethod.sign message, accessor
		return message

	_sendOAuthRequest: (args..., cb) ->
		message = @_createOAuthRequest args...
		JSONP.get message.action, OAuth.getParameterMap(message.parameters), false, cb

	# Public API
	# ----------

	startOAuthCallback: (url = window.location.href.replace(/\?.*$/, '')) ->
		@_sendOAuthRequest
			url: @manifest.auth.oauth.requestEndpoint
			token: true
			tokenSecret: true
		, [], (data) =>
			dataArray = querystring.parse(data)
			store.set "#{@id}-requestToken", dataArray["oauth_token"]
			store.set "#{@id}-requestTokenSecret", dataArray["oauth_token_secret"]

			document.location =  @manifest.auth.oauth.authorizeEndpoint + "?oauth_token=" + dataArray["oauth_token"] + "&oauth_callback=" + url

	completeOAuth: (cb) ->
		if @accessToken and @accessTokenSecret
			cb 0
			return
		unless @requestToken and @requestTokenSecret
			cb error: "OAuth token not yet requested."
			return

		@_sendOAuthRequest
			url:  @manifest.auth.oauth.accessEndpoint
			token: @requestToken
			tokenSecret: @requestTokenSecret
		, [], (data) =>
			dataArray = querystring.parse(data)
			store.set "#{@id}-accessToken", dataArray["oauth_token"]
			store.set "#{@id}-accessTokenSecret", dataArray["oauth_token_secret"]
			@accessToken = dataArray["oauth_token"]
			@accessTokenSecret = dataArray["oauth_token_secret"]

			cb()

	get: (path, [params]..., cb) ->
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
		###
		endpoint = url.parse base + path
		endpoint.query = {}
		for qk, qv of query
			endpoint.query[qk] = qv
		for filter in @filters
			filter endpoint
		# Normalize endpoint.
		endpointUrl = url.format endpoint
		endpoint = url.parse endpointUrl
		###
		endpointUrl = base + path

		# Create params list from object.
		list = ([k, params[k]] for k of (params or {}))
		# Send request
		@_sendOAuthRequest {url: endpointUrl}, list, (data) ->
			cb 0, data

	clearState: ->
		store.clear()