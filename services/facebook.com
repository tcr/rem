{
  "1": {
    "id": "facebook.com",
    "name": "Facebook",
    "docs": "https://developers.facebook.com/docs/reference/api/",
    "control": "https://developers.facebook.com/apps",

    "base": "https://graph.facebook.com",
    
    "uploadFormat": "form",

    "auth": {
      "type": "oauth",
      "version": "2.0",
      "base": "https://graph.facebook.com",
      "authorizePath": "/oauth/authorize",
      "tokenPath": "/oauth/access_token",
      "params": {
        "scope": ["email", "read_stream"],
        "display": "page"
      },
      "scopeSeparator": ",",
      "validate": "/me"
    },

    "cors": true
  }
}