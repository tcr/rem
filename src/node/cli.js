#!/usr/bin/env node

var fs = require('fs')
  , path = require('path');

var rem = require('../..')
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
		var domain = process.argv[2];

		if (domain == '--list') {
			console.log('Loaded APIs:')
			fs.readdirSync(path.join(__dirname, '../../services')).filter(function (api) {
				return !api.match(/^\.|\.json$/g);
			}).forEach(function (api) {
				console.log('  ' + api);
			})
			return;
		}

		if (process.argv.length == 3) {
			var api = rem.connect(domain, '*');
			var info = {};
			['id', 'name', 'docs', 'control'].forEach(function (key) {
				if (api.manifest[key]) {
					info[key] = api.manifest[key];
				}
			})
			dumpObject(info);
			return;
		}

		switch (process.argv[3]) {
			case 'config':
				switch (process.argv[4]) {
					case 'clear':
						rem.env.config.clear(domain + ':configuration');
						rem.env.config.save(function (err) {
							console.error('Configuration cleared.');
						});
						return;

					default:
						console.log('Stored API configuration:')
						dumpObject(rem.env.config.get(domain + ':configuration'));
						return;
				}
				break;

			case 'auth':
				switch (process.argv[4]) {
					case 'clear':
						rem.env.config.clear(domain + ':auth');
						rem.env.config.save(function (err) {
							console.error('Credentials cleared.');
						});
						return;

					default:
						console.log('Stored API credentials:')
						dumpObject(rem.env.config.get(domain + ':auth'));
						return;
				}
				break;

			case 'docs':
				var api = rem.connect(domain, '*');
				if (api.manifest.docs) {
					open(api.manifest.docs);
				} else {
					console.error('No API documentation found.');
				}
				return;
		}
	}

	console.error('Usage: rem [options]',
		'\n',
		'\n    rem --list',
		'\n    rem <domain>',
		'\n    rem <domain> docs',
		'\n    rem <domain> config [ clear ]',
		'\n    rem <domain> auth [ clear ]',
		'\n');
	process.exit(1);
})();