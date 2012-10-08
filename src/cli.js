#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var rem = require('..');

if (process.argv.length > 2) {
	switch (process.argv[2]) {
		case 'ls':
			console.log('APIs:')
			fs.readdirSync(path.join(__dirname, '../builtin')).forEach(function (api) {
				console.log('  ' + api.replace(/\..*$/, ''));
			})
			process.exit();

		case 'info':
			if (process.argv.length > 3) {
				var name = process.argv[3];
				var api = rem.load(name, '*');
				['id', 'name', 'docs', 'control', 'base'].forEach(function (key) {
					if (api.manifest[key]) {
						console.log(key + ': ' + api.manifest[key]);
					}
				})
				process.exit();
			}
	}
}

console.log('Usage: rem (ls|info [name])');
process.exit(1);