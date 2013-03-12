{
  "1": {
    "id": "linkedin.com",
    "name": "LinkedIn",
    "docs": "http://developer.linkedin.com/apis",
    "control": "https://www.linkedin.com/secure/developer",

    "base": "http://api.linkedin.com/v1",
    
    "uploadFormat": "form",

    "params": {
      "format": "json"
    },

    "auth": {
      "type": "oauth",
      "version": "2.0",
      "base": "https://www.linkedin.com/uas",
      "authorizePath": "/oauth2/authorization",
      "tokenPath": "/oauth2/accessToken",
      "params": {
        "scope": ["r_fullprofile"],
        "response_type": "code",
        "state": "a89dbjkl3_sdaihap98"
      },
      "scopeSeparator": " ",
      "accessTokenParam": "oauth2_access_token",
      "validate": "people/~"
    }
  }
}