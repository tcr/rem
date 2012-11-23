/*

REM: Remedial Rest Interfaces

A library that simplifies and normalizes access to REST APIs.

Reference:
http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven

*/

// Namespace.
var rem = typeof exports == 'undefined' ? this.rem = {} : exports;

var remutil = typeof require == 'undefined' ? remutil : require('./remutil');
rem.util = remutil;

// Configuration.
rem.USER_AGENT = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://remlib.org/)';
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
    if (this.type == 'json') {
      this.json = data;
    } else if (this.type == 'xml') {
      this.xml = data;
    }
    this.statusCode = Number(this.res.statusCode);
    this.err = this.statusCode > 400 ? this.statusCode : 0;
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
    var args = Array.prototype.slice.call(arguments, 1), next = args.pop();
    var fns = (this._middleware && this._middleware[type] || []).slice();
    function nextCallback() {
      if (fns.length == 0) {
        next();
      } else {
        fns.shift().apply(this, args.concat([nextCallback.bind(this)]));
      }
    }
    nextCallback.call(this);
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
    this.agent = this.opts.agent; // HTTP agents. Node-only.

    // Load format-specific options from the manifest.
    if (!this.manifest.formats) {
      this.manifest.formats = {json: {}};
    }
    if (!this.manifest.formats[this.format]) {
      throw new Error("Format \"" + this.format + "\" not available. Please specify an available format in the options parameter.");
    }
    this.manifest = remutil.modify(this.manifest, this.manifest.formats[this.format]);

    // User agent.
    this.pre('request', function (req, next) {
      req.headers['user-agent'] = req.headers['user-agent'] || rem.USER_AGENT;
      next();
    });
    // Route root pathname.
    if (this.manifest.basepath) {
      this.pre('request', function (req, next) {
        req.url.pathname = this.manifest.basepath + req.url.pathname;
        next();
      });
    }
    // Route suffix.
    if (this.manifest.suffix) {
      this.pre('request', function (req, next) {
        req.url.pathname += this.manifest.suffix;
        next();
      });
    }
    // Route configuration parameters.
    if (this.manifest.configParams) {
      this.pre('request', function (req, next) {
        var params = this.manifest.configParams;
        for (var key in params) {
          req.url.query[key] = this.opts[this.manifest.configParams[key]];
        }
        next();
      });
    }
    // Route static parameters.
    if (this.manifest.params) {
      this.pre('request', function (req, next) {
        var params = this.manifest.params;
        for (var key in params) {
          req.url.query[key] = params[key];
        }
        next();
      });
    }
  }

  // Configuration prompt.

  API.prototype.configure = function(cont) {
    return cont();
  };

  // Callable function.

  function invoke (api, segments, send) {
    var query = typeof segments[segments.length - 1] == 'object' ? segments.pop() : {};
    var pathname = remutil.path.join.apply(null, segments);

    return new Route(remutil.request.create({
      query: query, pathname: pathname
    }), api.manifest.uploadFormat, middleware);

    function middleware (req, next) {
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

        // Debug flag.
        if (api.debug) {
          console.error('[URL]', remutil.url.format(req.url));
        }

        // Apply manifest filters.
        api.middleware('request', req, function () {
          send(req, next);
        });
      });

      return req;
    }
  }

  API.prototype.stream = function () {
    return invoke(this, Array.prototype.slice.call(arguments), function (req, next) {
      this.send(req, function (err, res) {
        this.middleware('response', req, res, function () {
          next(req, res);
        });
      }.bind(this));
    }.bind(this));
  };

  API.prototype.call = function () {
    return invoke(this, Array.prototype.slice.call(arguments), function (req, next) {
      this.send(req, function (err, res) {
        if (err) {
          next && next(err, null, res);
        } else {
          this.middleware('response', req, res, function () {
            this.parseStream(req, res, function (data) {
              var media = new HyperMedia(this, res, data);
              next && next(media.err, media.data, media);
            }.bind(this));
          }.bind(this));
        }
      }.bind(this));
    }.bind(this));
  };

  API.prototype.parseStream = function (req, res, next) {
    remutil.consumeStream(res, function (data) {
      // Parse body
      try {
        if (this.format === 'xml') {
          data = rem.parsers.xml(String(data));
        } else {
          // Remove the BOM when it's been included.
          if (data[0] == 0xef && data[1] == 0xbb && data[2] == 0xbf) {
            data = data.slice(3);
          }
          data = JSON.parse(String(data));
        }
      } catch (e) {
        console.warn('Could not parse data for type ' + this.format + ':', e)
      }
      next(data);
    }.bind(this));
  };

  API.prototype.send = function (req, next) {
    remutil.request.send(req, this.agent, next);
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
      var configFile = rem.CONFIG_FILE || path.join(require('osenv').home(), '.remconf');
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
    };
    
  }

  // Throttling.

  API.prototype.throttle = function (rate) {
    var api = this, queue = [], rate = rate || 1;

    setInterval(function () {
      var fn = queue.shift();
      if (fn) {
        fn();
      }
    }, 1000/rate)

    var oldsend = api.send;
    api.send = function () {
      var args = arguments;
      queue.push(function () {
        oldsend.apply(api, args);
      });
    };

    return api;
  };

  // Return.

  return API;

})();

/**
 * Public API.
 */

rem.API = API;

rem.create = function (manifest, opts) {
  if (typeof manifest == 'string') {
    manifest = { base: manifest };
  }
  return remutil.callable(new API(manifest, opts));
};

// TODO Be able to load manifest files locally.
rem.load = function (name, version, opts) {
  manifest = remutil.lookup(name);
  version = version = '*' ? Number(version) || '*' : '*';
  if (!manifest || !manifest[version]) {
    if (version == '*' && manifest) {
      var version = Object.keys(manifest).sort().pop();
      if (!manifest[version]) {
        throw new Error('Unable to find API ' + JSON.stringify(name) + ' version ' + JSON.stringify(Number(version)) + '. For the latest API, use "*".');
      }
    } else if (manifest) {
      throw new Error('Unable to find API ' + JSON.stringify(name) + ' version ' + JSON.stringify(Number(version)) + '. For the latest API, use "*".');
    } else {
      throw new Error('Unable to find API ' + JSON.stringify(name) + '.');
    }
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
  url.query = remutil.modify(url.query, query);

  return new Route(remutil.request.create(url), 'form', function (req, next) {
    req.headers['user-agent'] = req.headers['user-agent'] || rem.USER_AGENT;
    // TODO rem.globalAgent
    remutil.request.send(req, next);
    return req;
  });
};

rem.consume = remutil.consumeStream;

rem.parsers = {
  xml: function (data) {
    try {
      var libxmljs = require('libxmljs');
    } catch (e) {
      throw new Error('Please install libxmljs in order to parse XML APIs.')
    }
    return libxmljs.parseXmlString(data);
  }
};

function jsonpath (obj, keys) {
  keys.split('.').filter(String).forEach(function (key) {
    obj = obj && obj[key];
  });
  return obj;
}

rem.poll = function (endpoint, opts, callback) {
  // opts is an optional argument with a 'interval', 'root', and 'date' param.
  callback = typeof callback == 'function' ? callback : opts;
  opts = typeof opts == 'object' ? opts : {};
  var interval = opts.interval || 1000;
  var ARRAY_ROOT = opts.root || '';
  var DATE_KEY = opts.date || 'created_at';

  var latest = null;
  setInterval(function () {
    endpoint.get(function (err, json) {
      if (json && jsonpath(json, ARRAY_ROOT)) {
        var root = jsonpath(json, ARRAY_ROOT);
        for (var i = 0; i < root.length; i++) {
          if (latest && new Date(jsonpath(root[i], DATE_KEY)) <= latest) {
            break;
          }
        }
        if (i > 0) {
          var items = root.slice(0, i);
          callback(null, items);
          latest = new Date(jsonpath(items[0], DATE_KEY));
        }
      }
    });
  }, interval);
}

if (typeof require != 'undefined') {
  // Authentication methods.
  require('./oauth');
  require('./aws');
  require('./session');

  // TODO more than Oauth.
  rem.console = rem.oauthConsole;
}
