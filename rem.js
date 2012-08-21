/*

REM: Remedial Rest Interfaces

A library that simplifies and normalizes access to REST APIs.

Reference:
http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven

*/

var util = require('util');
var fs = require('fs');
var path = require('path');

var async = require('async');
var read = require('read');
var express = require('express');
var nconf = require('nconf');
var osenv = require('osenv');
var clc = require('cli-color');

// Optional.
var libxmljs = null;

// Configuration.
var USER_AGENT = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://rem.tcr.io/)';
nconf.file(path.join(osenv.home(), '.rem.json'));

// Namespace.
var rem = exports;
var remutil = {};

/**
 * Utilities
 */

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
};

function modify (a, b) {
  var c = clone(a);
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

function callable (obj) {
  var f = function () {
    return f.call.apply(f, arguments);
  };
  f.__proto__ = obj;
  return f;
};

function consumeStream (stream, next) {
  var buf = [];
  stream.on('data', function (data) {
    buf.push(data);
  });
  stream.on('end', function () {
    next(Buffer.concat(buf));
  });
}

var safeJSONStringify = function (s) {
  return JSON.stringify(s).replace(/[\u007f-\uffff]/g, function (c) {
    return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
  });
};

/** 
 * URL primitive
 */

(function () {

  var url = require('url');

  remutil.url = {

    // protocol://auth@hostname:port/pathname?query#hash

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
    },

    host: function (obj) {
      return url.parse(url.format(obj), true).host;
    },

    path: function (obj) {
      return url.parse(url.format(obj), true).path;
    }

  };

})();

/**
 * Request primitive
 */

(function () {

  var http = require('http');
  var https = require('https');
  var querystring = require('querystring');

  remutil.request = {

    create: function (mod) {
      return remutil.request.url({
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT
        },
        url: null,
        body: null
      }, mod);
    },

    url: function (opts, mod) {
      if (typeof mod == 'string') {
        mod = remutil.url.parse(mod);
      }
      opts = modify(opts, {
        url: opts.url ? modify(opts.url, mod) : mod
      });
      return modify(opts, {
        headers: modify(opts.headers, {
          'Host': remutil.url.host(opts.url)
        })
      })
    },

    body: function (opts, type, body) {
      // Expand payload shorthand.
      if (typeof body == 'object') {
        if (type == 'form' || type == 'application/x-www-form-urlencoded') {
          type = 'application/x-www-form-urlencoded';
          body = querystring.stringify(body);
        }
        if (type == 'json' || type == 'application/json') {
          type = 'application/json';
          body = safeJSONStringify(body);
        }
      }

      return modify(opts, {
        headers: modify(opts.headers, {
          'Content-Type': type,
          'Content-Length': body.length
        }),
        body: body
      });
    },

    send: function (opts, next) {
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
    }

  };

})();

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
          libxmljs = require('libxmljs');
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
    this.defaultBodyMime = defaultBodyMime || 'form';
    this.middleware = middleware;
  }

  Route.prototype.get = function (query, next) {
    if (typeof query == 'function') {
      next = query;
      query = null;
    }
    return this.middleware(modify(remutil.request.url(this.req, {
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
    return this.middleware(modify(remutil.request.url(this.req, {
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
    return this.middleware(modify(remutil.request.body(this.req, mime, body), {
      method: 'POST'
    }), next);
  };

  Route.prototype.put = function (mime, body, next) {
    if (typeof body == 'function') {
      next = body;
      body = mime;
      mime = this.defaultBodyMime;
    }
    return this.middleware(modify(remutil.request.body(this.req, mime, body), {
      method: 'PUT'
    }, next));
  };

  Route.prototype.delete = function (next) {
    return this.middleware(modify(this.req, {
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

  util.inherits(API, Middleware);

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
    this.manifest = modify(this.manifest, this.manifest.formats[this.format]);

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
          req.url.query[key] = this.opts[key];
        }
      });
    }
    // Route static parameters.
    if (this.manifest.params) {
      this.pre('request', function (req) {
        var params = this.manifest.configParams;
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
            console.log(clc.yellow('Keys saved in ~/.rem.json\n'));
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
    var pathname = path.join.apply(null, segments);

    return new Route(remutil.request.create({
      query: query, pathname: pathname
    }), this.manifest.uploadFormat, middleware.bind(this));

    function middleware (req, next) {
      var api = this;

      // Expand payload shorthand.
      return api.configure(function () {
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
          pathname: path.join(req.url.pathname, pathname)
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
    }
  };

  API.prototype.send = function (req, next) {
    remutil.request.send(req, function (err, res) {
      if (err) {
        next(err, null, res);
      } else {
        consumeStream(res, function (data) {
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

  API.prototype.delete = function () {
    var route = this('');
    return route.delete.apply(route, arguments);
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
 * Cookie authentication.
 */

var CookieSessionAPI = (function () {

  util.inherits(CookieSessionAPI, API);

  function CookieSessionAPI (manifest, opts) {
    API.apply(this, arguments);

    this.pre('request', function (req) {
      req.headers['Cookie'] = this.opts.cookies;
    })
  }

  CookieSessionAPI.prototype.saveState = function (next) {
    return next({
      cookies: this.opts.cookies
    });
  };

  return CookieSessionAPI;

})();

var CookieSessionAuthentication = (function () {

  var toughCookie = require('tough-cookie');
  var Cookie = toughCookie.Cookie;
  var CookieJar = toughCookie.CookieJar;
  var querystring = require('querystring');

  function CookieSessionAuthentication (api) {
    this.api = api;
  }

  CookieSessionAuthentication.prototype.authenticate = function (username, password, callback) {
    // Create our request.
    var req = remutil.request.create('http://www.reddit.com/api/login');
    req.method = 'POST';
    req = remutil.request.body(req,
      'application/x-www-form-urlencoded',
      querystring.stringify({
        user: username,
        passwd: password
      }));

    var auth = this;
    remutil.request.send(req, function (err, res) {
      // Read cookies from headers.
      if (res.headers['set-cookie'] instanceof Array) {
        var cookies = res.headers['set-cookie'].map(Cookie.parse);
      } else if (res.headers['set-cookie'] != null) {
        var cookies = [Cookie.parse(res.headers['set-cookie'])];
      } else {
        var cookies = [];
      }

      // Retrieve authentication cookies from request using tough-cookie.
      var jar = new CookieJar();
      async.forEach(cookies.filter(function (cookie) {
        return (auth.api.manifest.auth.cookies || []).indexOf(cookie.key) != -1;
      }), function (cookie, next) {
        jar.setCookie(cookie, remutil.url.format(req.url), next);
      }, function (err) {
        if (err) {
          callback(err);
        } else {
          jar.getCookieString(remutil.url.format(req.url), function (err, cookies) {
            auth.loadState({cookies: cookies}, callback);
          })
        }
      });
    });
  };

  CookieSessionAuthentication.prototype.loadState = function (data, cb) {
    var opts;
    opts = clone(this.api.opts);
    opts.cookies = data.cookies;
    return cb(null, callable(new CookieSessionAPI(this.api.manifest, opts)));
  };

  return CookieSessionAuthentication;

})();

/**
 * HTTP Sessions.
 */

rem.session = function (api) {
  return new CookieSessionAuthentication(api);
};



/**
 * OAuth.
 */

// version = '1.0', '1.0a', '2.0'
// scopeSeparator
// validate
// oob
// oobCallback
// oobVerifier

rem.oauth = function (api, callback) {
  switch (String(api.manifest.auth.version).toLowerCase()) {
    case '1.0':
    case '1.0a':
      return rem.oauth1(api, callback);

    case '2.0':
      return rem.oauth2(api, callback);

    default:
      throw new Error('Invalid OAuth version ' + api.manifest.auth.version);
  }
};

/**
 * OAuth 1
 */

// requestEndpoint
// accessEndpoint
// authorizeEndpoint

var OAuth1API = (function (_super) {

  var nodeoauth = require("oauth");

  util.inherits(OAuth1API, API);

  function OAuth1API (manifest, opts) {
    API.apply(this, arguments);

    this.config = this.manifest.auth;
    this.oauth = new nodeoauth.OAuth(this.config.requestEndpoint,
      this.config.accessEndpoint, this.opts.key, this.opts.secret,
      this.config.version || '1.0', this.opts.oauthRedirect, "HMAC-SHA1", null, {
        'User-Agent': USER_AGENT,
        "Accept": "*/*",
        "Connection": "close"
      });
  }

  OAuth1API.prototype.send = function (req, next) {
    // OAuth request.
    var args = [remutil.url.format(req.url), this.opts.oauthAccessToken, this.opts.oauthAccessSecret];
    if (req.method === 'PUT' || req.method === 'POST') {
      // Signatures need to be calculated from forms; let node-oauth do that
      if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        args.push(querystring.parse(String(req.body)));
      } else {
        args.push(String(req.body), req.headers['content-type']);
      }
    }
    this.oauth[req.method.toLowerCase()].apply(this.oauth, args.concat([next]));
  };

  OAuth1API.prototype.saveState = function (next) {
    return next({
      oauthAccessToken: this.opts.oauthAccessToken,
      oauthAccessSecret: this.opts.oauthAccessSecret
    });
  };

  OAuth1API.prototype.saveSession = function (req, next) {
    req.session.oauthAccessToken = this.opts.oauthAccessToken;
    req.session.oauthAccessSecret = this.opts.oauthAccessSecret;
    req.user = this;
    return next(req);
  };

  OAuth1API.prototype.validate = function (next) {
    if (!this.config.validate) {
      throw new Error('Manifest does not define mechanism for validating OAuth.');
    }
    return this(this.config.validate).get(function (err, data) {
      return next(err);
    });
  };

  return OAuth1API;

})();

var OAuth1Authentication = (function () {

  var nodeoauth = require("oauth");

  function OAuth1Authentication(api, redirect) {
    this.api = api;

    // Configuration.
    this.config = this.api.manifest.auth;
    // Get redirect URL.
    this.oob = !redirect;
    if (!(redirect || this.config.oob)) {
      throw new Error('Out-of-band OAuth for this API is not permitted.');
    }
    this.oauthRedirect = redirect || this.config.oobCallback || undefined;
  }

  OAuth1Authentication.prototype.start = function () {
    var args = Array.prototype.slice.call(arguments);
    var next = args.pop();
    var params = args.pop();

    return this.api.configure(function () {
      this.oauth = new nodeoauth.OAuth(this.config.requestEndpoint, 
        this.config.accessEndpoint, this.api.key, this.api.secret,
        this.config.version || '1.0', this.oauthRedirect, "HMAC-SHA1", null, {
          'User-Agent': USER_AGENT,
          "Accept": "*/*",
          "Connection": "close"
        });

      // Filter parameters.
      params = modify(params || {}, this.config.params || {});
      if ((params.scope != null) && typeof params.scope === 'object') {
        params.scope = params.scope.join(this.config.scopeSeparator || ' ');
      }
      // oauth_callback needed for Twitter, etc.
      if (this.oauthRedirect) {
        params['oauth_callback'] = this.oauthRedirect;
      }

      this.oauth.getOAuthRequestToken(params, function (err, oauthRequestToken, oauthRequestSecret, results) {
        if (err) {
          console.error("Error requesting OAuth token: " + JSON.stringify(err));
        } else {
          var authurl = remutil.url.parse(this.config.authorizeEndpoint);
          authurl.query.oauth_token = oauthRequestToken;
          if (this.oauthRedirect) {
            authurl.query.oauth_callback = this.oauthRedirect;
          }
          next(remutil.url.format(authurl), oauthRequestToken, oauthRequestSecret, results);
        }
      }.bind(this));
    }.bind(this));
  };

  OAuth1Authentication.prototype.complete = function () {
    var args = Array.prototype.slice.call(arguments);
    var next = args.pop();
    var oauthRequestSecret = args.pop();
    var oauthRequestToken = args.pop();
    var verifier = args.pop();

    if (!verifier && (!this.oob || this.config.oobVerifier)) {
      throw new Error('Out-of-band OAuth for this API requires a verification code.');
    }
    if (!this.oob) {
      verifier = remutil.url.parse(verifier).query.oauth_verifier;
    }

    var auth = this;
    return this.oauth.getOAuthAccessToken(oauthRequestToken, oauthRequestSecret, verifier,
      function (err, oauthAccessToken, oauthAccessSecret, results) {
        if (err) {
          console.error("Error authorizing OAuth endpoint: " + JSON.stringify(err));
          cb(err, null, results);
        } else {
          return auth.loadState({
            oauthAccessToken: oauthAccessToken,
            oauthAccessSecret: oauthAccessSecret,
            oauthRedirect: auth.oauthRedirect
          }, function (user) {
            next(err, user, results);
          });
        }
      });
  };

  OAuth1Authentication.prototype.loadState = function (data, next) {
    var opts = clone(this.api.opts);
    opts.oauthAccessToken = data.oauthAccessToken;
    opts.oauthAccessSecret = data.oauthAccessSecret;
    opts.oauthRedirect = this.oauthRedirect;
    return next(callable(new OAuth1API(this.api.manifest, opts)));
  };

  OAuth1Authentication.prototype.startSession = function (req) {
    var args = Array.prototype.slice.call(arguments, 1);
    var next = args.pop();
    var params = args.pop();

    this.start(params, function (url, oauthRequestToken, oauthRequestSecret, results) {
      req.session.oauthRequestToken = oauthRequestToken;
      req.session.oauthRequestSecret = oauthRequestSecret;
      next(url, results);
    });
  };

  OAuth1Authentication.prototype.clearSession = function (req, next) {
    delete req.session.oauthAccessToken;
    delete req.session.oauthAccessSecret;
    delete req.session.oauthRequestToken;
    delete req.session.oauthRequestSecret;
    next();
  };

  OAuth1Authentication.prototype.loadSession = function (req, next) {
    this.loadState({
      oauthAccessToken: req.session.oauthAccessToken,
      oauthAccessSecret: req.session.oauthAccessSecret
    }, function (user) {
      req.user = user;
      next();
    });
  };

  OAuth1Authentication.prototype.middleware = function (callback) {
    var pathname = remutil.url.parse(this.oauthRedirect).pathname;

    var auth = this;
    return function (req, res, next) {
      if (req.path === pathname) {
        auth.complete(req.url, req.session.oauthRequestToken, req.session.oauthRequestSecret,
          function (err, user, results) {
            user.saveSession(req, function () {
              callback(req, res, next);
            });
          });
      } else {
        if (req.session.oauthAccessToken && req.session.oauthAccessSecret) {
          auth.loadSession(req, next);
        } else {
          next();
        }
      }
    };
  };

  return OAuth1Authentication;

})();

exports.oauth1 = function (api, callback) {
  return new OAuth1Authentication(api, callback);
};

/**
 * OAuth 2
 */

// base

var OAuth2API = (function (_super) {

  var nodeoauth = require("oauth");

  // Patch node-oauth.
  // oldreq = OAuth2::_request
  // OAuth2::_request = (method, url, headers, body, accessToken, cb) ->
  //  header['User-Agent'] = USER_AGENT
  //  oldreq.call this, method, url, headers, body, accessToken, cb
  // OAuth2::get = (url, accessToken, body, mime, cb) ->
  //  @_request "GET", url, {}, "", accessToken, cb
  nodeoauth.OAuth2.prototype.post = function (url, accessToken, body, mime, cb) {
    return this._request("POST", url, {
      "Content-Type": mime
    }, body, accessToken, cb);
  };
  nodeoauth.OAuth2.prototype.put = function (url, accessToken, body, mime, cb) {
    return this._request("PUT", url, {
      "Content-Type": mime
    }, body, accessToken, cb);
  };
  nodeoauth.OAuth2.prototype["delete"] = function (url, accessToken, body, mime, cb) {
    return this._request("DELETE", url, {}, "", accessToken, cb);
  };

  util.inherits(OAuth2API, API);

  function OAuth2API(manifest, opts) {
    // Constructor.
    API.apply(this, arguments);
    this.config = this.manifest.auth;
    this.oauth = new nodeoauth.OAuth2(this.opts.key, this.opts.secret, this.config.base);
  }

  OAuth2API.prototype.send = function (req, next) {
    // OAuth request.
    var args = [remutil.url.format(req.url), this.opts.oauthAccessToken];
    if (req.method === 'PUT' || req.method === 'POST') {
      args.push(String(req.body), req.headers['content-type']);
    }
    this.oauth[req.method.toLowerCase()].apply(this.oauth, args.concat([next]));
  };

  OAuth2API.prototype.validate = function (cb) {
    if (!this.opts.validate) {
      throw new Error('Manifest does not define mechanism for validating OAuth.');
    }
    return this(this.opts.validate).get(function (err, data) {
      return cb(err);
    });
  };

  OAuth2API.prototype.saveState = function (next) {
    return next({
      oauthRedirect: this.opts.oauthRedirect,
      oauthAccessToken: this.opts.oauthAccessToken,
      oauthRefreshToken: this.opts.oauthRefreshToken
    });
  };

  OAuth2API.prototype.saveSession = function (req, next) {
    req.session.oauthAccessToken = this.opts.oauthAccessToken;
    req.session.oauthRefreshToken = this.opts.oauthRefreshToken;
    req.user = this;
    return next(req);
  };

  return OAuth2API;

})(API);

var OAuth2Authentication = (function () {

  var nodeoauth = require("oauth");

  function OAuth2Authentication(api, redirect) {
    this.api = api;
    this.config = this.api.manifest.auth;
    // Get redirect URL.
    this.oob = !redirect;
    if (!(redirect || this.config.oob)) {
      throw new Error('Out-of-band OAuth for this API is not permitted.');
    }
    this.oauthRedirect = redirect || this.config.oobCallback || undefined;
  }

  OAuth2Authentication.prototype.start = function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = args.pop();
    var params = args.pop();

    var cb, params, _arg, _i;
    var _this = this;
    return this.api.configure(function () {
      _this.oauth = new nodeoauth.OAuth2(_this.api.key, _this.api.secret, _this.config.base, _this.config.authorizePath, _this.config.tokenPath);
      params = modify(_this.config.params || {}, params || {});
      if ((params.scope != null) && typeof params.scope === 'object') {
        params.scope = params.scope.join(_this.config.scopeSeparator || ' ');
      }
      params.redirect_uri = _this.oauthRedirect;
      return cb(_this.oauth.getAuthorizeUrl(params));
    });
  };

  OAuth2Authentication.prototype.complete = function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = args.pop();
    var verifier = args.shift();
    var token = args.shift();
    var secret = args.shift();

    var cb, secret, token, verifier, _arg, _i,
      _this = this;
    
    if (!this.oob) {
      verifier = remutil.url.parse(verifier).query.code;
    }
    return this.oauth.getOAuthAccessToken(verifier, {
      redirect_uri: this.oauthRedirect,
      grant_type: 'authorization_code'
    }, function (err, oauthAccessToken, oauthRefreshToken) {
      if (err) {
        console.error('Error authorizing OAuth2 endpoint:', JSON.stringify(err));
        return cb(err, null);
      } else {
        return _this.loadState({
          oauthAccessToken: oauthAccessToken,
          oauthRefreshToken: oauthRefreshToken
        }, function (user) {
          return cb(0, user);
        });
      }
    });
  };

  OAuth2Authentication.prototype.loadState = function (data, next) {
    var opts = clone(this.api.opts);
    opts.oauthAccessToken = data.oauthAccessToken;
    opts.oauthRefreshToken = data.oauthRefreshToken;
    opts.oauthRedirect = this.oauthRedirect;
    return next(callable(new OAuth2API(this.api.manifest, opts)));
  };

  OAuth2Authentication.prototype.startSession = function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = args.pop();
    var req = args.shift();
    var params = args.pop();

    // noop.
    return this.start(params, cb);
  };

  OAuth2Authentication.prototype.clearSession = function (req, cb) {
    delete req.session.oauthAccessToken;
    delete req.session.oauthRefreshToken;
    return cb();
  };

  OAuth2Authentication.prototype.loadSession = function (req, cb) {
    return this.loadState({
      oauthAccessToken: req.session.oauthAccessToken,
      oauthRefreshToken: req.session.oauthRefreshToken
    }, function (user) {
      req.user = user;
      return cb();
    });
  };

  OAuth2Authentication.prototype.middleware = function (cb) {
    var _this = this;
    var pathname = remutil.url.parse(this.oauthRedirect).pathname;
    return function (req, res, next) {
      if (req.path === pathname) {
        return _this.complete(req.url, function (err, user, results) {
          return user.saveSession(req, function () {
            return cb(req, res, next);
          });
        });
      } else {
        if (req.session.oauthAccessToken != null) {
          return _this.loadSession(req, next);
        } else {
          return next();
        }
      }
    };
  };

  return OAuth2Authentication;

})();

exports.oauth2 = function (api, callback) {
  return new OAuth2Authentication(api, callback);
};

/**
 * Oauth console.
 */

exports.oauthConsoleOob = function () {
  var api, cb, params, _arg, _i;
  api = arguments[0], _arg = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
  params = _arg[0];
  return api.configure(function () {
    // Out-of-band authentication.
    var oauth;
    oauth = rem.oauth(api);
    return oauth.start(function (url, token, secret) {
      console.log(clc.yellow("To authenticate, visit: " + url));
      if (api.manifest.auth.oobVerifier) {
        return read({
          prompt: clc.yellow("Type in the verification code: ")
        }, function (err, verifier) {
          return oauth.complete(verifier, token, secret, cb);
        });
      } else {
        return read({
          prompt: clc.yellow("Hit any key to continue...")
        }, function (err) {
          console.log("");
          return oauth.complete(token, secret, cb);
        });
      }
    });
  });
};

exports.oauthConsole = function () {
  var args = Array.prototype.slice.call(arguments);
  var cb = args.pop();
  var api = args.shift();
  var params = args.pop();

  return api.configure(function () {
    // Create OAuth server configuration.
    var app, oauth, port, _ref1;
    port = (_ref1 = params != null ? params.port : void 0) != null ? _ref1 : 3000;
    oauth = rem.oauth(api, "http://localhost:" + port + "/oauth/callback/");
    app = express.createServer();
    app.use(express.cookieParser());
    app.use(express.session({
      secret: "!"
    }));

    // OAuth callback.
    app.use(oauth.middleware(function (req, res, next) {
      res.send("<h1>Oauthenticated.</h1><p>Return to your console, hero!</p><p><a href='/'>Retry?</a></p>");
      console.log("");
      return process.nextTick(function () {
        return cb(null, req.user);
      });
    }));
    // Login page.
    app.get('/', function (req, res) {
      return oauth.startSession(req, params || {}, function (url) {
        return res.redirect(url);
      });
    });
    // Listen on server.
    app.listen(port);
    console.log(clc.yellow("To authenticate, visit: http://localhost:" + port + "/"));
    return console.log(clc.yellow("(Note: Your callback URL should point to http://localhost:" + port + "/oauth/callback/)"));
  });
};

/**
 * AWS signature.
 */

var AWSSignatureAPI = (function (_super) {

  var querystring = require('querystring');
  var crypto = require('crypto');

  util.inherits(AWSSignatureAPI, API);

  function AWSSignatureAPI (manifest, opts) {
    AWSSignatureAPI.__super__.constructor.apply(this, arguments);
  }

  AWSSignatureAPI.prototype.processRequest = function (method, endpointUrl, mime, body, cb) {
    var endpoint, hash, k, v;
    endpoint = new Url(endpointUrl);

    // Add timestamp parameter.
    endpoint.query.Timestamp = new Date().toJSON();
    // Create a signature of query arguments.
    // TODO also POST arguments...
    hash = crypto.createHmac('sha256', this.opts.secret);
    hash.update([
      // Method
      "GET",
      // Value of host: header in lowercase
      endpoint.hostname.toLowerCase(),
      // HTTP Request URI
      endpoint.pathname,
      // Canonical query string (in byte order)
      ((function () {
        var _ref1, _results;
        _ref1 = endpoint.query;
        _results = [];
        for (k in _ref1) {
          v = _ref1[k];
          _results.push([k, v]);
        }
        return _results;
      })()).sort(function (_arg, _arg1) {
        var a, b;
        a = _arg[0];
        b = _arg1[0];
        return a > b;
      }).map(function (_arg) {
        var k, v;
        k = _arg[0], v = _arg[1];
        return querystring.escape(k) + '=' + querystring.escape(v);
      }).join('&')
    ].join('\n'));
    endpoint.query.Signature = hash.digest('base64');

    // HTTP Request.
    return sendHttpRequest(method, endpoint.toString(), mime, body, {
      data: cb
    });
  };

  return AWSSignatureAPI;

})();

exports.aws = function (api) {
  return callable(new AWSSignatureAPI(api.manifest, api.opts));
};

/** 
 * Generic console.
 */

// TODO more than Oauth.
exports.console = exports.oauthConsole;

/**
 * Public API.
 */

rem.API = API;

rem.create = function (manifest, opts) {
  return callable(new API(manifest, opts));
};

// TODO Be able to load manifest files locally.
rem.load = function (name, version, opts) {
  version = version || '1';
  try {
    var manifest = JSON.parse(fs.readFileSync(__dirname + '/common/' + name + '.json'))[version];
  } catch (e) {
    throw new Error('Unable to find API ' + name + '::' + version);
  }
  if (!manifest) {
    throw 'Manifest not found';
  }
  manifest.id = name;
  manifest.version = version;
  return rem.create(manifest, opts);
};

rem.url = function () {
  var segments = Array.prototype.slice.call(arguments);
  var query = typeof segments[segments.length - 1] == 'object' ? segments.pop() : {};
  var url = remutil.url.parse(segments.shift());
  url.pathname = path.join.apply(null, [url.pathname].concat(segments));
  url.query = query;

  return new Route(remutil.request.create(url), 'form', function (req, next) {
    remutil.request.send(req, next);
  });
};

rem.consume = consumeStream;