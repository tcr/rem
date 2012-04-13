rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Github
# ======

github = rem.load 'github', '1'

console.log 'See a list of gists by timcameronryan:'
github.get '/users/timcameronryan/gists', {}, (err, json) ->
	for gist in json
		console.log gist.description