document.write "<script type='text/javascript' src='../../lib/oauth.js'></script>"
document.write "<script type='text/javascript' src='../../lib/sha1.js'></script>"
document.write "<script type='text/javascript' src='../../lib/jsonp.js'></script>"
document.write "<script type='text/javascript' src='../../lib/store.min.js'></script>"

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

	constructor: (@name, @version = '1', opts) ->
		@manifest = manifests[@name][@version]

		{@key, @secret} = opts
		@id = @type + REM._counter++

		# Initialize store.
		for k in ['requestToken', 'requestTokenSecret', 'accessToken', 'accessTokenSecret'] when store.get("#{@id}-#{k}")?
			@[k] = store.get("#{@id}-#{k}")

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
			url: "https://api.dropbox.com/1/oauth/request_token"
			type: "text"
			token: true
			tokenSecret: true
		, [], (data) =>
			dataArray = querystring.parse(data)
			store.set "#{@id}-requestToken", dataArray["oauth_token"]
			store.set "#{@id}-requestTokenSecret", dataArray["oauth_token_secret"]

			document.location = "https://www.dropbox.com/1/oauth/authorize?oauth_token=" + dataArray["oauth_token"] + "&oauth_callback=" + url

	completeOAuth: (cb) ->
		if @accessToken and @accessTokenSecret
			cb 0
			return
		unless @requestToken and @requestTokenSecret
			cb error: "OAuth token not yet requested."
			return

		@_sendOAuthRequest
			url: "https://api.dropbox.com/1/oauth/access_token"
			type: "text"
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
		list = ([k, params[k]] for k of (params or {}))
		@_sendOAuthRequest {url: @_host + path}, list, (data) ->
			cb 0, data

	_host: "https://api.dropbox.com/1"

	getUrl: (path, [params]..., cb) ->
		list = ([k, params[k]] for k of (params or {}))
		message = @_createOAuthRequest {url: @_host + path}, list
		return message.action + '?' + querystring.stringify OAuth.getParameterMap(message.parameters)

	clearState: ->
		store.clear()