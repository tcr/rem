# REM Tests
# =========

REM = require './rem'
fs = require 'fs'

ask = (question, format, callback) ->
	stdin = process.stdin
	stdout = process.stdout
	stdin.resume()
	stdout.write question
	stdin.once "data", (data) ->
		data = data.toString().trim()
		if format.test(data)
			callback data
		else
			stdout.write "It should match: " + format + "\n"
			ask question, format, callback

demos = {}

keys = JSON.parse fs.readFileSync 'keys.json'

# Google Calendar
# ---------------

demos['google-calendar'] = ->
	gcal = new REM 'google-calendar', '2'
	gcal.key = 'anonymous'
	gcal.secret = 'anonymous'

	gcal.performOAuth (url, results, cb) ->
		console.log "Visit:", url
		ask "Please enter the verification code: ", /[\w\d]+/, cb
	, (results) ->
		gcal.get '/default/allcalendars/full', {}, (err, action) ->
			if err
				console.log err
			else
				for cal in action.json.data.items
					console.log '[GCAL]', cal.title

# YouTube
# -------

demos['youtube'] = ->
	yt = new REM 'youtube', '2'
	#yt.key = keys.youtube.key
	yt.key = 'anonymous'
	yt.secret = 'anonymous'

	#yt.performOAuth (url, results, cb) ->
	#	console.log "Visit:", url
	#	ask "Please enter the verification code: ", /[\w\d]+/, cb
	#, (results) ->
	yt.get '/videos', {q: 'surfing'}, (err, action) ->
		if err
			console.log 'Error', err, action.text
		else
			console.log '[YOUTUBE]', 'Number of surfing videos:', action.json.data.totalItems

# Dropbox Demo
# ------------

demos['dropbox'] = ->
	dbox = new REM 'dropbox', '1'
	dbox.key = keys.dropbox.key
	dbox.secret = keys.dropbox.secret

	dbox.performOAuth (url, results, cb) ->
		console.log "Visit:", url
		ask "Hit enter when finished...", /.*/, cb
	, (results) ->
		dbox.put '/files_put/sandbox/coolio.txt', {}, 'text/plain', 'Hello kendall!!!', (err, action) ->
			console.log action.json

		#dbox.get '/metadata/sandbox/', {}, (err, action) ->
		#	console.log action.json

# Twitter Demo
# ------------

demos['twitter'] = ->
	tw = new REM 'twitter', '1'
	tw.key = keys.twitter.key
	tw.secret = keys.twitter.secret

	tw.performOAuth (url, results, cb) ->
		console.log "Visit:", url
		ask "Please enter the verification code: ", /[\w\d]+/, cb
	, (results) ->
		tw.get '/statuses/home_timeline', {}, (err, action) ->
			for twt in action.json
				console.log '[TWITTER]', twt.text


# DuckDuckGo
# ----------

demos['duckduckgo'] = ->
	ddg = new REM 'duckduckgo', '1'

	ddg.get '/', q: 'valley forge national park', (err, action) ->
		console.log '[DDG]', action.json.Heading

# Github
# ------

demos['github'] = ->
	github = new REM 'github', '1'

	github.get '/users/noahlt/gists', {}, (err, action) ->
		console.log '[GITHUB]', action.json[0].description
		console.log '[GITHUB]', action.rate

# Tumblr
# ------

demos['tumblr'] = ->
	tumblr = new REM 'tumblr', '2'
	tumblr.key = keys.tumblr.key

	tumblr.get '/blog/heysaturdaysun.tumblr.com/posts/text', {}, (err, action) ->
		console.log '[TUMBLR]', action.json.response.blog.title + ' - ' + action.json.response.blog.description

# Run demos
# =========

if not process.argv[2]
	console.log 'coffee test [test name]'
	for k of demos then console.log ' - ', k
else
	demos[process.argv[2]]()