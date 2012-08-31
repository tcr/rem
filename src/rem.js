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

  API.prototype._promptConfig = false;

  API.prototype._persistConfig = false;

  API.prototype.prompt = function (_persistConfig) {
    this._persistConfig = _persistConfig || _persistConfig == null;
    this._promptConfig = true;
    return this;
  };

  API.prototype.configure = function (cont) {
    return cont();

    var nconf = require('nconf');
    var read = require('read');
    var clc = require('cli-color');
    var path = require('path');

    // Configuration.
    nconf.file(rem.CONFIG_FILE || path.join(require('osenv').home(), '.rem.json'));

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
      console.log(clc.yellow('Application control panel:'), this.manifest.control);
    }
    return read({
      prompt: clc.yellow(this.manifest.id + ' API key: ')
    }, function (err, key) {
      _this.key = key;
      _this.opts.key = key;
      return read({
        prompt: clc.yellow(_this.manifest.id + ' API secret: ')
      }, function (err, secret) {
        _this.secret = secret;
        _this.opts.secret = secret;
        if (_this._persistConfig) {
          nconf.set(_this.manifest.id + ':key', key);
          nconf.set(_this.manifest.id + ':secret', secret);
          return nconf.save(function (err, json) {
            console.log(clc.yellow('Keys saved to ' + rem.CONFIG_FILE + '\n'));
            return cont();
          });
        } else {
          console.log('');
          return cont();
        }
      });
    });
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
