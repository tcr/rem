{
  "1": {
    "name": "Dropbox",
    "docs": "https://www.dropbox.com/developers",
    "control": "https://www.dropbox.com/developers/apps",

    "base": [
      ["^/(files(_put)?|thumbnails)/.*", "https://api-content.dropbox.com/1"],
      "https://api.dropbox.com/1"
    ],
    
    "jsonp": true,

    "auth": {
      "type": "oauth",
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