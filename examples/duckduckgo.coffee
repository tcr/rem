rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# DuckDuckGo
# ==========

ddg = rem.load 'duckduckgo', '1'

ddg.get q: 'java', (err, json, obj) ->
	console.log 'Search for "java":', json.Heading
