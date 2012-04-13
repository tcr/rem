rem = require '../rem'
fs = require 'fs'
{ask} = require './utils'

# Github
# ======

cee = rem.load 'nonolith', '1'

cee("devices/com.nonolithlabs.cee*/#{process.argv[2]}/output")
	.post mode: 'svmi', value: process.argv[3], (err, json) ->