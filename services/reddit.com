{
  "1": {
    "id": "reddit.com",
    "name": "Reddit",
    "docs": "https://github.com/reddit/reddit/wiki/API",
    "configuration": [],

    "base": "https://ssl.reddit.com/",
    "uploadFormat": "form",

    "formats": {
      "xml": {"suffix": ".xml"},
      "json": {"suffix": ".json"}
    },

    "auth": {
      "type": "basic:cookies",
      "loginEndpoint": "https://ssl.reddit.com/api/login",
      "payload": {
        "user": "username",
        "passwd": "password"
      },
      "cookies": ["reddit_session"]
    }
  }
}