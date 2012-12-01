#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var rem = require('..');
var open = require('open');

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

		case 'docs':
			if (process.argv.length > 3) {
				var name = process.argv[3];
				var api = rem.load(name, '*');
				if (api.manifest.docs) {
					open(api.manifest.docs);
					process.exit();
				} else {
					console.error('No API documentation found.');
				}
			}
	}
}

console.log('Usage: rem (ls|info [name]|docs [name])');
process.exit(1);