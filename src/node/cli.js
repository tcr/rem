#!/usr/bin/env node

var fs = require('fs')
  , path = require('path');

var rem = require('rem')
  , open = require('open');

function dumpObject (obj, prefix) {
	prefix = prefix || ' ';
	for (var key in obj) {
		if (typeof obj[key] == 'object') {
			dumpObject(obj[key], prefix + ' -');
		} else {
			console.log(prefix, key, '=>', obj[key]);
		}
	}
}

(function () {
	if (process.argv.length > 2) {
		switch (process.argv[2]) {
			case 'ls':
				console.log('APIs:')
				fs.readdirSync(path.join(__dirname, '../builtin')).forEach(function (api) {
					console.log('  ' + api.replace(/\..*$/, ''));
				})
				return;

			case 'config':
				switch (process.argv[3]) {
					case 'delete':
						rem.env.config.clear(process.argv[4] + ':key');
						rem.env.config.clear(process.argv[4] + ':secret');
						rem.env.config.save(function (err) {
							console.error('Configuration cleared.');
						});
						return;

					case 'info':
						console.log('Auth credentials:')
						console.log('  key =>', rem.env.config.get(process.argv[4] + ':key'));
						console.log('  secret =>', rem.env.config.get(process.argv[4] + ':secret'));
						return;
				}
				break;

			case 'auth':
				switch (process.argv[3]) {
					case 'delete':
						rem.env.config.clear(process.argv[4] + ':oauth');
						rem.env.config.save(function (err) {
							console.error('Credentials cleared.');
						});
						return;

					case 'info':
						console.log('Auth credentials:')
						dumpObject(rem.env.config.get(process.argv[4] + ':oauth'));
						return;
				}
				break;

			case 'info':
				if (process.argv.length > 3) {
					var name = process.argv[3];
					var api = rem.load(name, '*');
					var info = {};
					['id', 'name', 'docs', 'control', 'base'].forEach(function (key) {
						if (api.manifest[key]) {
							info[key] = api.manifest[key];
						}
					})
					dumpObject(info);
					return;
				}
				break;

			case 'docs':
				if (process.argv.length > 3) {
					var name = process.argv[3];
					var api = rem.load(name, '*');
					if (api.manifest.docs) {
						open(api.manifest.docs);
					} else {
						console.error('No API documentation found.');
					}
					return;
				}
				break;
		}
	}

	console.error('Usage: rem [options]',
		'\n',
		'\n    rem ls',
		'\n    rem info [domain]',
		'\n    rem docs [domain]',
		'\n    rem config (info|delete) [domain]',
		'\n    rem auth (info|delete) [domain]',
		'\n');
	process.exit(1);
})();