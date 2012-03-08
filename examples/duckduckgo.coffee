REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# DuckDuckGo
# ==========

ddg = new REM 'duckduckgo', '1'

ddg.get '/', q: 'valley forge national park', (err, action) ->
	console.log '[DDG]', action.json.Heading
