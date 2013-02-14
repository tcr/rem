{
  "2": {
    "id": "tumblr.com",
    "name": "Tumblr",
    "docs": "http://www.tumblr.com/docs/en/api/v2",
    "control": "http://www.tumblr.com/oauth/apps",

    "base": "http://api.tumblr.com/v2",
    "configParams": {"api_key": "key"},
    "uploadFormat": "form",

    "auth": {
      "type": "oauth",
      "version": "1.0a",
      "requestEndpoint": "https://www.tumblr.com/oauth/request_token",
      "accessEndpoint": "https://www.tumblr.com/oauth/access_token",
      "authorizeEndpoint": "https://www.tumblr.com/oauth/authorize",
      "validate": "/user/info",
      "oob": false,
      "oobVerifier": false
    }
  }
}