// Namespace.
var remutil = typeof require == 'undefined' ? this.remutil = {} : exports;

/**
 * Utilities
 */

remutil.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

remutil.modify = function (a, b) {
  var c = remutil.clone(a);
  for (var k in a) {
    if (Object.prototype.hasOwnProperty.call(a, k)) {
      c[k] = a[k];
    }
  }
  for (var k in b) {
    if (Object.prototype.hasOwnProperty.call(b, k)) {
      c[k] = b[k];
    }
  }
  return c;
};

remutil.callable = function (obj) {
  var f = function () {
    return f.call.apply(f, arguments);
  };
  f.__proto__ = obj;
  return f;
};

remutil.safeJSONStringify = function (s) {
  return JSON.stringify(s).replace(/[\u007f-\uffff]/g, function (c) {
    return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
  });
};

remutil.inherits = function (ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false
    }
  });
};

remutil.consumeStream = null;

/**
 * EventEmitter
 */

function EventEmitter () { }

EventEmitter.prototype.listeners = function (type) {
  return this.hasOwnProperty.call(this._events || (this._events = {}), type) ? this._events[type] : this._events[type] = [];
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener = function (type, f) {
  if (this._maxListeners !== 0 && this.listeners(type).push(f) > (this._maxListeners || 10)) {
    console && console.warn('Possible EventEmitter memory leak detected. ' + this._events[type].length + ' listeners added. Use emitter.setMaxListeners() to increase limit.');
  }
  this.emit("newListener", type, f);
  return this;
};

EventEmitter.prototype.removeListener = function (type, f) {
  var i;
  (i = this.listeners(type).indexOf(f)) != -1 && this.listeners(type).splice(i, 1);
  return this;
};

EventEmitter.prototype.removeAllListeners = function (type) {
  for (var k in this._events) {
    (!type || type == k) && this._events[k].splice(0, this._events[k].length);
  }
  return this;
};

EventEmitter.prototype.emit = function (type) {
  var args = Array.prototype.slice.call(arguments, 1);
  for (var i = 0, fns = this.listeners(type).slice(); i < fns.length; i++) {
    fns[i].apply(this, args);
  }
  return fns.length;
};

EventEmitter.prototype.setMaxListeners = function (maxListeners) {
  this._maxListeners = maxListeners;
};

remutil.EventEmitter = EventEmitter;

/** 
 * URL primitive
 */

// protocol://auth@hostname:port/pathname?query#hash

remutil.url = {

  parse: null,

  format: null,

  host: function (url) {
    return url.hostname && (url.hostname + (url.port ? ':' + url.port : ''));
  },

  path: function (url) {
    return url.pathname
      + (url.query ? '?' + remutil.qs.stringify(url.query) : '')
      + (url.hash ? '#' + encodeURIComponent(url.hash) : '');
  }

};

/**
 * Request primitive
 */

remutil.request = {

  create: function (mod) {
    return remutil.request.url({
      method: 'GET',
      headers: {},
      url: null,
      body: null
    }, mod);
  },

  url: function (opts, mod) {
    if (typeof mod == 'string') {
      mod = remutil.url.parse(mod);
    }
    mod.query = remutil.modify(opts.url ? opts.url.query : {}, mod.query);
    opts = remutil.modify(opts, {
      url: opts.url ? remutil.modify(opts.url, mod) : mod
    });
    return remutil.modify(opts, {
      headers: remutil.modify(opts.headers, {
        'Host': remutil.url.host(opts.url)
      })
    })
  },

  body: function (opts, type, body) {
    // Expand payload shorthand.
    if (typeof body == 'object') {
      if (type == 'form' || type == 'application/x-www-form-urlencoded') {
        type = 'application/x-www-form-urlencoded';
        body = remutil.qs.stringify(body);
      }
      if (type == 'json' || type == 'application/json') {
        type = 'application/json';
        body = remutil.safeJSONStringify(body);
      }
    }

    return remutil.modify(opts, {
      headers: remutil.modify(opts.headers, {
        'Content-Type': type,
        'Content-Length': body.length
      }),
      body: body
    });
  },

  send: null

};

/**
 * Query string parsing.
 */

remutil.qs = {

  stringify: null,

  parse: null

};

/**
 * Path
 */

remutil.path = {

  join: null

};

/** 
 * Manifest lookup.
 */

remutil.lookup = function (name) {
  var fs = require('fs');
  var path = require('path');
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../common', name + '.json')));
  } catch (e) {
    return null;
  }
};

/**
 * Node.js
 */

(typeof require != 'undefined') && (function () {

  // Stream.

  remutil.consumeStream = function (stream, next) {
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

  remutil.url.parse = function (str) {
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
  };

  remutil.url.format = function (str) {
    return url.format(str);
  };

  // Request

  var http = require('http');
  var https = require('https');
  var querystring = require('querystring');

  remutil.request.send = function (opts, next) {
    var req = (opts.url.protocol == 'https:' ? https : http).request({
      method: opts.method,
      headers: opts.headers,
      protocol: opts.url.protocol,
      hostname: opts.url.hostname,
      port: opts.url.port,
      path: remutil.url.path(opts.url)
    });

    // Response.
    req.on('response', function (res) {
      // Attempt to follow Location: headers.
      if (((res.statusCode / 100) | 0) == 3 && res.headers['location']) {
        remutil.request.send(remutil.request.url(opts, res.headers['location']), next);
      } else {
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

  remutil.qs = require('querystring');

  // Path

  remutil.path = require('path');

})();

/**
 * Browser.
 */

(typeof require == 'undefined') && (function () {

  // Stream.

  remutil.consumeStream = function (stream, next) {
    var buf = [];
    stream.on('data', function (data) {
      buf.push(data);
    });
    stream.on('end', function () {
      next(buf.join(''));
    });
  };

  // URL

  remutil.url.parse = function (str) {
    var a = document.createElement('a');
    a.href = str;
    return {
      protocol: a.protocol,
      auth: a.auth,
      hostname: a.hostname,
      port: a.port,
      pathname: a.pathname,
      query: remutil.qs.parse(a.search || ''),
      hash: a.hash && decodeURIComponent(a.hash.substr(1))
    };
  };

  remutil.url.format = function (url) {
    var a = document.createElement('a');
    a.protocol = url.protocol;
    a.auth = url.auth;
    a.hostname = url.hostname;
    a.port = url.port;
    a.pathname = url.pathname;
    a.query = remutil.qs.stringify(url.query);
    a.hash = url.hash;
    return a.href;
  };

  // Query string

  remutil.qs.parse = function (query) {
    var ret = {};
    var seg = query.replace(/^\?/, '').replace(/\+/g, ' ').split('&');
    for (var i = 0, len = seg.length, s; i < len; i++) {
      if (seg[i]) {
        s = seg[i].split('=');
        ret[decodeURIComponent(s[0])] = decodeURIComponent(s[1]);
      }
    }
    return ret;
  };

  remutil.qs.stringify = function (query) {
    var str = [];
    for (var k in query) {
      str.push(encodeURIComponent(k) + (query[k] == null ? '' : '=' + encodeURIComponent(query[k])));
    }
    return str.join('&');
  };

  // Request

  remutil.inherits(HTTPResponse, EventEmitter);

  function HTTPResponse (xhr) {
    var len = 0;
    this.statusText = xhr.statusText;
    this.statusCode = xhr.status;
    xhr.onreadystatechange = function () {
      if (xhr.readyState == 3) {
        this.emit('data', xhr.responseText.substr(len));
        len = xhr.responseText.length;
      }
      if (xhr.readyState == 4) {
        if (len < xhr.responseText.length) {
          this.emit('data', xhr.responseText.substr(len));
        }
        this.emit('end')
      }
    }.bind(this);
  }

  remutil.request.send = function (opts, next) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function () {
      if (req.readyState == 2) {
        var res = new HTTPResponse(req);
        next(((req.statusCode / 100) | 0) != 2 && req.statusCode, res);
      }
    }

    // Send request.
    req.open(opts.method, remutil.url.format(opts.url), true);
    for (var k in opts.headers) {
      req.setRequestHeader(k, opts.headers[k]);
    }
    req.send(opts.body);
  };

  // Path

  remutil.path.join = function () {
    var args = Array.prototype.slice.call(arguments);
    var a = document.createElement('a');
    a.href = window.location.href;
    a.pathname = args.join('/').replace(/\/+/g, '/');
    return a.pathname.substr(args[0] && args[0][0] == '/' ? 0 : 1);
  };

})();
/*

REM: Remedial Rest Interfaces

A library that simplifies and normalizes access to REST APIs.

Reference:
http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven

*/

// Namespace.
var rem = typeof exports == 'undefined' ? this.rem = {} : exports;
var remutil = typeof require == 'undefined' ? remutil : require('./remutil');

// Configuration.
rem.USER_AGENT = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://rem.tcr.io/)';
rem.CONFIG_FILE = null;

/**
 * A hypermedia resource.
 */

var HyperMedia = (function () {

  function HyperMedia (api, res, data) {
    this.api = api;
    this.res = res;
    this.data = data;

    this.type = api.format;
    this.statusCode = Number(this.res.statusCode);
    this.err = this.statusCode > 400 ? this.statusCode : 0;

    // Parse body
    try {
      if (this.type === 'xml') {
        if (!libxmljs) {
          var libxmljs = require('libxmljs');
        }
        this.data = this.xml = libxmljs.parseXmlString(String(this.data));
      } else {
        this.data = this.json = JSON.parse(String(this.data));
      }
    } catch (e) {
      this.err = e;
      console.warn('Could not parse data for type ' + this.type + '.')
    }
  }

  return HyperMedia;

})();

/**
 * A route endpoint.
 */

var Route = (function () {

  function Route (req, defaultBodyMime, middleware) {
    this.req = req;
    this.defaultBodyMime = defaultBodyMime || 'json';
    this.middleware = middleware;
  }

  Route.prototype.get = function (query, next) {
    if (typeof query == 'function') {
      next = query;
      query = null;
    }
    return this.middleware(remutil.modify(remutil.request.url(this.req, {
      query: query || {}
    }), {
      method: 'GET'
    }), next);
  };

  Route.prototype.head = function (query, next) {
    if (typeof query == 'function') {
      next = query;
      query = null;
    }
    return this.middleware(remutil.modify(remutil.request.url(this.req, {
      query: query || {}
    }), {
      method: 'HEAD'
    }), next);
  };

  Route.prototype.post = function (mime, body, next) {
    if (typeof body == 'function') {
      next = body;
      body = mime;
      mime = this.defaultBodyMime;
    }
    return this.middleware(remutil.modify(remutil.request.body(this.req, mime, body), {
      method: 'POST'
    }), next);
  };

  Route.prototype.put = function (mime, body, next) {
    if (typeof body == 'function') {
      next = body;
      body = mime;
      mime = this.defaultBodyMime;
    }
    return this.middleware(remutil.modify(remutil.request.body(this.req, mime, body), {
      method: 'PUT'
    }), next);
  };

  Route.prototype.del = function (next) {
    return this.middleware(remutil.modify(this.req, {
      method: 'DELETE'
    }), next);
  };

  return Route;

})();

/**
 * Middleware.
 */

var Middleware = (function () {

  function Middleware () { }

  Middleware.prototype.pre = function (type, callback) {
    this._middleware || (this._middleware = {});
    (this._middleware[type] || (this._middleware[type] = [])).push(callback);
    return this;
  };

  Middleware.prototype.middleware = function (type) {
    var args = Array.prototype.slice.call(arguments, 1);
    (this._middleware && this._middleware[type] || []).forEach(function (callback) {
      callback.apply(this, args);
    }.bind(this));
    return this;
  };

  return Middleware;

})();

/**
 * API
 */

var API = (function () {

  remutil.inherits(API, Middleware);

  function API (manifest, opts) {
    this.manifest = manifest;
    this.opts = opts || {};

    // Load key, secret, format.
    this.key = this.opts.key;
    this.secret = this.opts.secret;
    this.format = this.opts.format || 'json';

    // Load format-specific options from the manifest.
    if (!this.manifest.formats) {
      this.manifest.formats = {json: {}};
    }
    if (!this.manifest.formats[this.format]) {
      throw new Error("Format \"" + this.format + "\" not available. Please specify an available format in the options parameter.");
    }
    this.manifest = remutil.modify(this.manifest, this.manifest.formats[this.format]);

    // User agent.
    this.pre('request', function (req) {
      req.headers['User-Agent'] = req.headers['User-Agent'] || rem.USER_AGENT;
    });
    // Route root pathname.
    if (this.manifest.basepath) {
      this.pre('request', function (req) {
        req.url.pathname = this.manifest.basepath + req.url.pathname;
      });
    }
    // Route suffix.
    if (this.manifest.suffix) {
      this.pre('request', function (req) {
        req.url.pathname += this.manifest.suffix;
      });
    }
    // Route configuration parameters.
    if (this.manifest.configParams) {
      this.pre('request', function (req) {
        var params = this.manifest.configParams;
        for (var key in params) {
          req.url.query[key] = this.opts[this.manifest.configParams[key]];
        }
      });
    }
    // Route static parameters.
    if (this.manifest.params) {
      this.pre('request', function (req) {
        var params = this.manifest.params;
        for (var key in params) {
          req.url.query[key] = params[key];
        }
      });
    }
  }

  // Configuration prompt.

  API.prototype.configure = function(cont) {
    return cont();
  };

  // Callable function.

  API.prototype.call = function () {
    var segments = Array.prototype.slice.call(arguments);
    var query = typeof segments[segments.length - 1] == 'object' ? segments.pop() : {};
    var pathname = remutil.path.join.apply(null, segments);

    return new Route(remutil.request.create({
      query: query, pathname: pathname
    }), this.manifest.uploadFormat, middleware.bind(this));

    function middleware (req, next) {
      var api = this;

      // Expand payload shorthand.
      api.configure(function () {
        // Determine base that matches the path name.
        var pathname = req.url.pathname.replace(/^(?!\/)/, '/')
        // Bases can be fixed or an array of (pattern, base) tuples.
        if (Array.isArray(api.manifest.base)) {
          var base = '';
          api.manifest.base.some(function (tuple) {
            if (typeof tuple == 'string') {
              // TODO this functionality should be removed
              base = tuple;
              return true;
            } else {
              if (pathname.match(new RegExp(tuple[0]))) {
                base = tuple[1];
                return true;
              }
            }
          });
        } else {
          var base = String(api.manifest.base);
        }
        // Update the request with base.
        req = remutil.request.url(req, remutil.url.parse(base))
        req = remutil.request.url(req, {
          pathname: remutil.path.join(req.url.pathname, pathname)
        });

        // Apply manifest filters.
        api.middleware('request', req);
        api.send(req, function (err, data, res) {
          if (next) {
            var media = new HyperMedia(api, res, data);
            return next(media.err, media.data, media);
          }
        });
      });

      return req;
    }
  };

  API.prototype.send = function (req, next) {
    remutil.request.send(req, function (err, res) {
      if (err) {
        next(err, null, res);
      } else {
        remutil.consumeStream(res, function (data) {
          next(err, data, res);
        });
      }
    });
  }

  // Root request shorthands.

  API.prototype.get = function () {
    var route = this('');
    return route.get.apply(route, arguments);
  };

  API.prototype.post = function () {
    var route = this('');
    return route.post.apply(route, arguments);
  };

  API.prototype.del = function () {
    var route = this('');
    return route.del.apply(route, arguments);
  };

  API.prototype.head = function () {
    var route = this('');
    return route.head.apply(route, arguments);
  };

  API.prototype.put = function () {
    var route = this('');
    return route.put.apply(route, arguments);
  };

  API.prototype.patch = function () {
    var route = this('');
    return route.patch.apply(route, arguments);
  };

  // Configuration/prompt

  if (typeof require !== 'undefined') {

    API.prototype._promptConfig = false;

    API.prototype._persistConfig = false;

    API.prototype.prompt = function (_persistConfig) {
      this._persistConfig = _persistConfig || _persistConfig == null;
      this._promptConfig = true;
      return this;
    };

    API.prototype.configure = function (cont) {
      //return cont();

      var nconf = require('nconf');
      var read = require('read');
      var clc = require('cli-color');
      var path = require('path');

      // Configuration.
      var configFile = rem.CONFIG_FILE || path.join(require('osenv').home(), '.rem.json');
      nconf.file(configFile);

      // Optionally prompt for API key/secret.
      var k, v, _ref, _ref1,
        _this = this;
      if (this.key || !(this._promptConfig && this.manifest.id)) {
        return cont();
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
      return read({
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
    };
    
  }

  // Return.

  return API;

})();

/**
 * Public API.
 */

rem.API = API;

rem.create = function (manifest, opts) {
  return remutil.callable(new API(manifest, opts));
};

// TODO Be able to load manifest files locally.
rem.load = function (name, version, opts) {
  version = version || '1';
  var manifest = remutil.lookup(name);
  if (!manifest || !manifest[version]) {
    throw new Error('Unable to find API ' + name + '::' + version);
  }
  manifest = manifest[version];
  manifest.id = name;
  manifest.version = version;
  return rem.create(manifest, opts);
};

rem.url = function () {
  var segments = Array.prototype.slice.call(arguments);
  var query = typeof segments[segments.length - 1] == 'object' ? segments.pop() : {};
  var url = remutil.url.parse(segments.shift());
  url.pathname = remutil.path.join.apply(null, [url.pathname].concat(segments));
  url.query = query;

  return new Route(remutil.request.create(url), 'form', function (req, next) {
    req.headers['User-Agent'] = req.headers['User-Agent'] || rem.USER_AGENT;
    remutil.request.send(req, next);
    return req;
  });
};

rem.consume = remutil.consumeStream;

if (typeof require != 'undefined') {
  // Authentication methods.
  require('./oauth');
  require('./aws');
  require('./session');

  // TODO more than Oauth.
  rem.console = rem.oauthConsole;
}
