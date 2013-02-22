{
	"4": {
		"id": "echonest.com",
		"base": "http://developer.echonest.com/api/v4/",
		"docs": "http://developer.echonest.com/docs/v4",
		"control": "https://developer.echonest.com/account/profile",

		"params": {
			"format": "jsonp"
		},
		"configParams": {
			"api_key": "key"
		},

		"jsonp": "callback"
	}
}
