rem = require '../rem'
fs = require 'fs'
read = require 'read'
express = require 'express'

keys = JSON.parse fs.readFileSync __dirname + '/keys.json'

# Tumblr
# ======

tumblr = rem.load 'tumblr', '2',
	key: keys.tumblr.key

tumblr('blog/staff.tumblr.com/posts/text').get (err, json) ->
	console.log json.response.blog.title + ' - ' + json.response.blog.description