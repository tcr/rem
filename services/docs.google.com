{
  "3": {
    "id": "docs.google.com",
    "name": "Google Docs",
    "control": "https://code.google.com/apis/console/",

    "base": "https://www.googleapis.com/drive/v2/",
    "params": {
      "v": "3"
    },

    "formats": {
      "json": {}
    },

    "auth": {
      "type": "oauth",
      "version": "2.0",
      "base": "https://accounts.google.com/o",
      "authorizePath": "/oauth2/auth",
      "tokenPath": "/oauth2/token",
      "params": {
        "scope": ["https://docs.google.com/feeds/", "https://docs.googleusercontent.com/", "https://spreadsheets.google.com/feeds/"],
        "response_type": "code"
      },
      "validate": "/metadata/default",
      "scopeSeparator": " ",
      "oob": true,
      "oobVerifier": true,
      "oobCallback": "urn:ietf:wg:oauth:2.0:oob"
    }
  }
}