{
	"4": {
		"id": "echonest.com",
		"docs": "http://developer.echonest.com/docs/v4",
		"control": "https://developer.echonest.com/account/profile",
		
		"base": "http://developer.echonest.com/api/v4/",

		"uploadFormat": "form",

		"params": {
			"format": "json"
		},
		"configParams": {
			"api_key": "key"
		}
	}
}
