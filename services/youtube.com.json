{
  "2": {
    "id": "youtube.com",
    "name": "Youtube",
    "register": "https://code.google.com/apis/console/",

    "base": "https://gdata.youtube.com/feeds/api",
    "params": {
      "v": "2"
    },
    "configParams": {"key": "devkey"},

    "formats": {
      "xml": {},
      "json": {"params": {"alt": "jsonc"}}
    },

    "auth": {
      "type": "oauth",
      "version": "2.0",
      "base": "https://accounts.google.com/o",
      "authorizePath": "/oauth2/auth",
      "tokenPath": "/oauth2/token",
      "params": {
        "scope": ["http://gdata.youtube.com"],
        "response_type": "code"
      },
      "scopeSeparator": " ",
      "oob": true,
      "oobVerifier": true,
      "oobCallback": "urn:ietf:wg:oauth:2.0:oob"
    }
  }
}