{
  "1": {
    "id": "instagram.com",
    "name": "Instagram",
    "docs": "http://instagram.com/developer/endpoints/",
    "control": "http://instagram.com/developer/clients/manage/",

    "base": "https://api.instagram.com/v1",
    "configParams": {"client_id": "key"},
    
    "uploadFormat": "form",

    "auth": {
      "type": "oauth",
      "version": "2.0",
      "base": "https://api.instagram.com",
      "authorizePath": "/oauth/authorize",
      "tokenPath": "/oauth/access_token",
      "params": {
        "response_type": "code"
      },
      "scopeSeparator": " ",
      "validate": "/users/self"
    },

    "jsonp": "callback"
  }
}