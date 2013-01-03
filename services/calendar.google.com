{
  "3": {
    "id": "calendar.google.com",
    "name": "Google Calendar",
    "docs": "https://developers.google.com/google-apps/calendar/",
    "control": "https://code.google.com/apis/console/",

    "base": "https://www.googleapis.com/calendar/v3",
    "params": {
      "v": "3"
    },
    "configParams": {"key": "key"},

    "auth": {
      "type": "oauth",
      "version": "2.0",
      "base": "https://accounts.google.com/o",
      "authorizePath": "/oauth2/auth",
      "tokenPath": "/oauth2/token",
      "params": {
        "scope": ["http://www.google.com/calendar/feeds"],
        "response_type": "code"
      },
      "validate": "/users/me/calendarList",
      "scopeSeparator": " ",
      "oob": true,
      "oobVerifier": true,
      "oobCallback": "urn:ietf:wg:oauth:2.0:oob"
    }
  }
}