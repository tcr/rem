{
  "1": {
    "id": "reddit.com",
    "name": "Reddit",
    "docs": "https://github.com/reddit/reddit/wiki/API",

    "base": "https://ssl.reddit.com/",
    "uploadFormat": "form",

    "formats": {
      "xml": {"suffix": ".xml"},
      "json": {"suffix": ".json"}
    },

    "auth": {
      "type": "cookies",
      "cookies": ["reddit_session"]
    }
  }
}