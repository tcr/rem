{
	"2": {
		"id": "lastfm.com",
		"base": "http://ws.audioscrobbler.com/2.0/",
		"docs": "http://www.last.fm/api/intro",
		"control": "http://www.last.fm/api/accounts",

		"params": {
			"format": "json"
		},
		"configParams": {
			"api_key": "key"
		}
	}
}