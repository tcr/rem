var env = exports;

// inherits

env.inherits = require('util').inherits;

// EventEmitter

env.EventEmitter = require('events').EventEmitter;

// Stream.

env.consumeStream = function (stream, next) {
  var buf = [];
  stream.on('data', function (data) {
    buf.push(data);
  });
  stream.on('end', function () {
    next(Buffer.concat(buf));
  });
};

// URL

var url = require('url');

env.url = {
  parse: function (str) {
    var parsed = url.parse(String(str), true);
    return {
      protocol: parsed.protocol,
      auth: parsed.auth,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      query: parsed.query || {},
      search: parsed.search,
      hash: parsed.hash
    };
  },

  format: function (str) {
    return url.format(str);
  }
};

// Request

var http = require('http');
var https = require('https');
var querystring = require('querystring');

// Some servers actually have an issue with this.
function camelCaseHeaders (lower) {
  var camel = {};
  for (var key in lower) {
    camel[key.replace(/(?:^|\b)\w/g, function (match) {
      return match.toUpperCase();
    })] = lower[key];
  }
  return camel;
}

env.sendRequest = function (opts, agent, next) {
  // Accept HTTP agent. Node.js only.
  if (next == null) {
    next = agent;
    agent = null;
  }

  var req = (opts.url.protocol == 'https:' ? https : http).request({
    agent: agent || undefined,
    method: opts.method,
    headers: camelCaseHeaders(opts.headers),
    protocol: opts.url.protocol,
    hostname: opts.url.hostname,
    port: opts.url.port,
    path: env.url.path(opts.url)
  });

  // Response.
  req.on('response', function (res) {
    // Attempt to follow Location: headers.
    if (((res.statusCode / 100) | 0) == 3 && res.headers['location'] && opts.redirect !== false) {
      env.request.send(env.request.url(opts, res.headers['location']), agent, next);
    } else {
      res.url = env.url.format(opts.url); // Populate res.url property
      next && next(null, res);
    }
  });

  // Headers.
  if (opts.body != null) {
    req.write(opts.body);
  }
  req.end();

  return req;
};

// Query

env.qs = require('querystring');

// Path

env.joinPath = require('path').join;

// XML Parsing

env.parseXML = function (data, next) {
  try {
    var libxmljs = require('libxmljs');
  } catch (e) {
    throw new Error('Please install libxmljs in order to parse XML APIs.')
  }
  next(libxmljs.parseXmlString(data));
};

// Lookup

env.lookupManifestSync = function (name) {
  var fs = require('fs');
  var path = require('path');
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../services', name + '.json')));
  } catch (e) {
    return null;
  }
};

env.lookupManifest = function (name, next) {
  var fs = require('fs');
  var path = require('path');
  fs.readFile(path.join(__dirname, '../services', name + '.json', function (err, data) {
    try {
      next(err, !err && JSON.parse(String(data)));
    } catch (e) {
      next(e);
    }
  });
};

// Configuration/prompt

env.promptConfiguration = function (api, next) {
  var nconf = require('nconf');
  var read = require('read');
  var clc = require('cli-color');
  var path = require('path');

  // Configuration.
  var configFile = rem.configFile || path.join(require('osenv').home(), '.remconf');
  nconf.file(configFile);

  // Optionally prompt for API key/secret.
  var k, v, _ref, _ref1,
    _this = this;
  if (this.key) {
    return cont();
  }
  if (!(this._promptConfig && this.manifest.id)) {
    throw new Error('No API key specified.');
  }
  if (this._persistConfig && nconf.get(this.manifest.id)) {
    _ref = nconf.get(this.manifest.id);
    for (k in _ref) {
      v = _ref[k];
      this.opts[k] = v;
    }
    _ref1 = this.opts, this.key = _ref1.key, this.secret = _ref1.secret;
    return cont();
  }
  console.log(clc.yellow('Initializing API keys for ' + this.manifest.id + ' on first use.'));
  if (this.manifest.control) {
    console.log(clc.yellow('Register for an API key here:'), this.manifest.control);
  }
  this.middleware('configure', function () {
    read({
      prompt: clc.yellow(this.manifest.id + ' API key: ')
    }, function (err, key) {
      _this.key = key;
      _this.opts.key = key;
      if (!key) {
        console.error(clc.red('ERROR:'), 'No API key specified, aborting.');
        process.exit(1);
      }
      return read({
        prompt: clc.yellow(_this.manifest.id + ' API secret (if provided): ')
      }, function (err, secret) {
        _this.secret = secret;
        _this.opts.secret = secret;
        if (_this._persistConfig) {
          nconf.set(_this.manifest.id + ':key', key);
          nconf.set(_this.manifest.id + ':secret', secret);
          return nconf.save(function (err, json) {
            console.log(clc.yellow('Your credentials are saved to the configuration file ' + configFile));
            console.log(clc.yellow('Edit that file to update or change your credentials.\n'));
            return cont();
          });
        } else {
          console.log('');
          return cont();
        }
      });
    });
  });
}