{
  "1": {
    "id": "twitter.com",
    "name": "Twitter",
    "docs": "https://dev.twitter.com/docs",
    "control": "https://dev.twitter.com/apps",

    "base": [
      ["^/search", "https://search.twitter.com"],
      ["^/statuses/(sample|filter|firehose)", "https://stream.twitter.com/1"],
      ["^/user$", "https://userstream.twitter.com/1"],
      ["", "https://api.twitter.com/1"]
    ],

    "formats": {
      "xml": {"suffix": ".xml"},
      "json": {"suffix": ".json"}
    },
    "uploadFormat": "form",

    "auth": {
      "type": "oauth",
      "version": "1.0a",
      "requestEndpoint": "https://api.twitter.com/oauth/request_token",
      "accessEndpoint": "https://api.twitter.com/oauth/access_token",
      "authorizeEndpoint": "https://api.twitter.com/oauth/authorize",
      "validate": "/account/verify_credentials",
      "oob": true,
      "oobVerifier": true,
      "oobCallback": "oob"
    },

    "jsonp": "callback"
  },
  "1.1": {
    "id": "twitter.com",
    "name": "Twitter",
    "docs": "https://dev.twitter.com/docs",
    "control": "https://dev.twitter.com/apps",

    "base": [
      ["^/statuses/(sample|filter|firehose)", "https://stream.twitter.com/1.1"],
      ["^/user$", "https://userstream.twitter.com/1.1"],
      ["", "https://api.twitter.com/1.1"]
    ],

    "formats": {
      "xml": {"suffix": ".xml"},
      "json": {"suffix": ".json"}
    },
    "uploadFormat": "form",

    "auth": {
      "type": "oauth",
      "version": "1.0a",
      "requestEndpoint": "https://api.twitter.com/oauth/request_token",
      "accessEndpoint": "https://api.twitter.com/oauth/access_token",
      "authorizeEndpoint": "https://api.twitter.com/oauth/authorize",
      "validate": "/account/verify_credentials",
      "oob": true,
      "oobVerifier": true,
      "oobCallback": "oob"
    },

    "jsonp": "callback"
  }
}