var env = exports;

// inherits

env.inherits = require('util').inherits;

// EventEmitter/Streams

env.EventEmitter = require('events').EventEmitter;
env.Stream = require('stream').Stream;

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

env.parseURL = function (str) {
  var parsed = url.parse(String(str), true);
  return {
    protocol: parsed.protocol || undefined,
    auth: parsed.auth || undefined,
    hostname: parsed.hostname || undefined,
    port: parsed.port || undefined,
    pathname: parsed.pathname || undefined,
    query: parsed.query || {},
    hash: parsed.hash || undefined
  };
};

env.formatURL = function (obj) {
  return url.format(obj);
};

env.url = {
  parse: function (str) {
    var parsed = url.parse(String(str), true);
    return {
      protocol: parsed.protocol || undefined,
      auth: parsed.auth || undefined,
      hostname: parsed.hostname || undefined,
      port: parsed.port || undefined,
      pathname: parsed.pathname || undefined,
      query: parsed.query || {},
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
function camelCase (key) {
  return key.replace(/(?:^|\b)\w/g, function (match) {
    return match.toUpperCase();
  });
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
    headers: (function () {
      var headers = {};
      for (var key in opts.headers) {
        headers[camelCase(key)] = opts.headers[key];
      }
      return headers;
    })(),
    protocol: opts.url.protocol,
    hostname: opts.url.hostname,
    port: opts.url.port,
    path: opts.url.getPath()
  });

  // Response.
  req.on('response', function (res) {
    // Follow Location: headers if the option is enabled.
    if (opts.redirect !== false && ((res.statusCode / 100) | 0) == 3 && res.headers['location']) {
      // Update the request with the new header and change the method.
      opts.method = 'GET';
      opts.url.parse(res.headers['location']);
      env.sendRequest(opts, agent, next)
        .end();
    } else {
      res.url = String(opts.url); // Populate res.url property.
      next && next(null, res);
    }
  });

  // Return unclosed request.
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

function getInvokingPath (levels) {
  return (new Error()).stack.split('\n')[1 + levels].replace(/^.*?\(|:\d+:\d+\).*?$/g, '');
}

env.lookupManifestSync = function (name) {
  var file = name.match(/^\./)
    ? path.join(path.dirname(getInvokingPath(3)), name)
    : path.join(MANIFEST_PATH, path.join('/', name));
  var json;
  try {
    json = fs.readFileSync(file, 'utf-8');
  } catch (e) {
    return null;
  }
  return json ? JSON.parse(json) : null;
};

env.lookupManifest = function (name, next) {
  var file = name.match(/^\./)
    ? path.join(path.dirname(getInvokingPath(3)), name)
    : path.join(MANIFEST_PATH, path.join('/', name));
  fs.readFile(file, 'utf-8', function (err, data) {
    if (err) {
      return next(err);
    }
    next(null, JSON.parse(data));
  });
};

// Array/Buffer detection

env.isList = function (obj) {
  return Array.isArray(obj) || Buffer.isBuffer(obj);
};

env.concatList = function (obj) {
  return Buffer.concat(obj.map(function (arg) {
    return Buffer.isBuffer(arg) ? arg : new Buffer(String(arg));
  }))
};

// Next tick.

env.nextTick = process.nextTick.bind(process);

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
  // TODO report in a less obtrusive way
  // console.error('Invalid .remconf settings, overwriting file.'.yellow);
}

env.promptConfiguration = function (rem, api, callback) {
  var read = require('read');

  // Check for existing configuration values.
  if (api.manifest.configuration.every(function (key) {
      return key in api.options;
    })) {
    return callback(null, api);
  }

  // Load configuration.
  if (env.config.get(api.manifest.id)) {
    var config = env.config.get(api.manifest.id + ':configuration');
    if (config && Object.keys(config).length) {
      api.manifest.configuration.forEach(function (key) {
        api.options[key] = config[key];
      });
      console.error(('Loaded API configuration from ' + env.config.stores.file.file).yellow);
      return callback(null, api);
    }
  }

  // Prompt API keys.
  console.error(('Configuring the API ' + api.manifest.id + ' on first use.').yellow);
  if (api.manifest.control) {
    console.error('Register and manage your credentials here:'.yellow, api.manifest.control);
  }

  // Configure, then request key and optionally a secret.
  requestKey(function () {
    if (api.manifest.configuration.indexOf('secret') > -1) {
      requestSecret(persist);
    } else {
      persist();
    }
  });

  function requestKey (next) {
    read({
      prompt: (api.manifest.id + ' API key: ').yellow
    }, function (err, key) {
      if (!key) {
        console.error('ERROR:'.red, 'No API key entered, aborting.');
        process.exit(1);
      }

      api.options.key = key;
      next();
    });
  }

  function requestSecret (next) {
    read({
      prompt: (api.manifest.id + ' API secret: ').yellow
    }, function (err, secret) {
      if (!secret) {
        console.error('ERROR:'.red, 'No API secret entered, aborting.');
        process.exit(1);
      }

      api.options.secret = secret;
      next();
    });
  }

  function persist () {
    if (persistConfig) {
      api.manifest.configuration.forEach(function (key) {
        env.config.set(api.manifest.id + ':configuration:' + key, api.options[key]);
      });
      env.config.save(function (err, json) {
        console.error(('Your credentials are saved to the configuration file ' + env.config.stores.file.file).yellow);
        console.error(('Use "rem ' + api.manifest.id + ' config [clear]" to manage these values.\n').yellow);
        callback(null, api);
      });
    } else {
      console.log('');
      callback(null, api);
    }
  }
};

// Prompt authentication.

env.promptAuthentication = function (rem, api, opts, next) {
  var args = Array.prototype.slice.call(arguments);
  switch (api.manifest.auth && api.manifest.auth.type) {
    case 'oauth':
      return rem.promptOAuth.call(rem, api, opts, next);
    case 'basic:cookies':
      return rem.promptBasicAuth.call(rem, api, opts, next);
    default:
      throw new Error('No support for this authentication type.');
  }
};

// Creation handler.

env.oncreate = function () { };