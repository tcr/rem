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
      protocol: parsed.protocol || undefined,
      auth: parsed.auth || undefined,
      hostname: parsed.hostname || undefined,
      port: parsed.port || 0,
      pathname: parsed.pathname || undefined,
      query: parsed.query || {},
      search: parsed.search || undefined,
      hash: parsed.hash || undefined
    };
  },

  format: function (str) {
    return url.format(str);
  },

  path: function (obj) {
    return url.parse(url.format(obj), true).path;
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
      opts.url = env.url.parse(res.headers['location']);
      env.sendRequest(opts, agent, next);
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

var fs = require('fs');
var path = require('path');

var MANIFEST_PATH = path.join(__dirname, '../../services');

env.lookupManifestSync = function (name) {
  var file = name.match(/^\./) ? path : path.join(MANIFEST_PATH, path.join('/', name));
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return null;
  }
};

env.lookupManifest = function (name, next) {
  var file = name.match(/^\./) ? path : path.join(MANIFEST_PATH, path.join('/', name));
  fs.readFile(file, 'utf-8', function (err, data) {
    try {
      next(err, !err && JSON.parse(data));
    } catch (e) {
      next(e, null);
    }
  });
};

// Array/Buffer detection

env.isList = function (obj) {
  return Array.isArray(obj) || Buffer.isBuffer(obj);
}

// Prompt strings.

env.promptString = function (ask, next) {
  read({prompt: ask}, next);
};

// Prompt configuration.

var persistConfig = true;

var path = require('path');
require('colors');

env.config = require('nconf');
try {
  env.config.file(path.join(require('osenv').home(), '.remconf'));
} catch (e) {
  console.error('Invalid .remconf settings, overwriting file.'.yellow);
}

env.promptConfiguration = function (rem, api, opts, next) {
  var read = require('read');

  // Check for existing key/secret.
  if (api.options.key) {
    return next();
  }

  // Load configuration.
  if (env.config.get(api.manifest.id)) {
    var config = env.config.get(api.manifest.id);
    if (config.key) {
      for (var k in config) {
        api.options[k] = config[k];
      }
      return next();
    }
  }

  // Prompt API keys.
  console.log(('Initializing API keys for ' + api.manifest.id + ' on first use.').yellow);
  if (api.manifest.control) {
    console.log('Register for an API key here:'.yellow, api.manifest.control);
  }
  api.middleware('configure', function () {
    read({
      prompt: (api.manifest.id + ' API key: ').yellow
    }, function (err, key) {
      if (!key) {
        console.error('ERROR:'.red, 'No API key specified, aborting.');
        process.exit(1);
      }

      api.options.key = key;
      read({
        prompt: (api.manifest.id + ' API secret (if provided): ').yellow
      }, function (err, secret) {

        api.options.secret = secret;
        if (persistConfig) {
          env.config.set(api.manifest.id + ':key', key);
          env.config.set(api.manifest.id + ':secret', secret);
          env.config.save(function (err, json) {
            console.log(('Your credentials are saved to the configuration file ' + env.config.stores.file.file).yellow);
            console.log(('Edit that file to update or change your credentials.\n').yellow);
            next();
          });
        } else {
          console.log('');
          next();
        }
      });
    });
  });
};

// Prompt authentication.

env.promptAuthentication = function (rem, api, opts, next) {
  var args = Array.prototype.slice.call(arguments);
  switch (api.manifest.auth && api.manifest.auth.type) {
    case 'oauth':
      return rem.promptOAuth.call(rem, api, opts, next);
    case 'cookies':
      return rem.promptSession.call(rem, api, opts, next);
    default:
      throw new Error('No support for this authentication type.');
  }
};