REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Github
# ======

github = new REM 'github', '1'

github.get '/users/noahlt/gists', {}, (err, action) ->
	console.log '[GITHUB]', action.json[0].description
	console.log '[GITHUB]', action.rate