rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# DuckDuckGo
# ==========

ddg = rem.load 'duckduckgo', '1'

ddg.get '/', q: 'valley forge national park', (err, json) ->
	console.log '[DDG]', json.Heading
