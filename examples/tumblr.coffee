REM = require '../rem'
fs = require 'fs'
{ask} = require './utils'
keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Tumblr
# ======

tumblr = new REM 'tumblr', '2'
tumblr.key = keys.tumblr.key

tumblr.get '/blog/heysaturdaysun.tumblr.com/posts/text', {}, (err, action) ->
	console.log '[TUMBLR]', action.json.response.blog.title + ' - ' + action.json.response.blog.description