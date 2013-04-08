{
  "1": {
    "id": "coinbase.com",
    "base": "https://coinbase.com/api/v1/",
    "docs": "https://coinbase.com/api/doc",
    "control": "https://coinbase.com/transactions",
    "uploadFormat": "json",
    "params": {
      "format": "json"
    },
    "configParams": {
      "api_key": "key"
    }
  }
}