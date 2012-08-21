/*

REM: Remedial Rest Interfaces

A library that simplifies and normalizes access to REST APIs.

See more:
http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven
*/

var API, AWSSignatureAPI, Cookie, CookieJar, CookieSessionAPI, CookieSessionAuthentication, HyperMedia, OAuth1API, OAuth1Authentication, OAuth2API, OAuth2Authentication, Q, Route, USER_AGENT, Url, callable, clc, express, fs, http, https, iterateJSON, libxmljs, nconf, nodeoauth, osenv, path, querystring, read, rem, safeJSONStringify, sendHttpRequest, util, _ref,
  __slice = [].slice,
  __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor () { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function (item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

var querystring = require('querystring');
var https = require('https');
var http = require('http');
var util = require('util');
var fs = require('fs');
var Q = require('q');
var read = require('read');
var express = require('express');
var nconf = require('nconf');
var path = require('path');
var osenv = require('osenv');
var clc = require('cli-color');

// Conditional requires.
var libxmljs = null;

// Configuration.
var USER_AGENT = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://rem.tcr.io/)';
nconf.file(path.join(osenv.home(), '.rem.json'));

// Alias.
var rem = exports;

/**
 * Utilities.
 */

var callable = function (obj) {
  var f = function () {
    return f.call.apply(f, arguments);
  };
  f.__proto__ = obj;
  return f;
};

JSON.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

Object.augment = function (a, b) {
  for (var k in b) {
    if (Object.prototype.hasOwnProperty.call(b, k)) {
      a[k] = b[k];
    }
  }
  return a;
};

var iterateJSON = function (obj, level, fn) {
  var i, k, x, _i, _len;
  fn(obj, level);
  if (typeof obj === 'object' && obj) {
    if (obj.constructor === Array) {
      for (i = _i = 0, _len = obj.length; _i < _len; i = ++_i) {
        x = obj[i];
        iterateJSON(x, level.concat([i]), fn);
      }
    } else {
      for (k in obj) {
        x = obj[k];
        iterateJSON(x, level.concat([k]), fn);
      }
    }
  }
};

var safeJSONStringify = function (s) {
  return JSON.stringify(s).replace(/[\u007f-\uffff]/g, function (c) {
    return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
  });
};

/**
 * Url class.
 */

function createURL (arg) {
  var url = require('url');
  var str = typeof arg == 'string' ? arg : url.format(arg);
  var obj = url.parse(str, true);
  obj.copy = function (opts) {
    return url.format(Object.augment(url.parse(str, true), opts || {}));
  }
  return obj;
}

/**
 * HTTP abstraction.
 */

var sendHttpRequest = function (method, endpointUrl, mime, body, handlers) {
  var endpoint, opts, req, _ref,
    _this = this;
  if (handlers == null) {
    handlers = {};
  }

  // Create HTTP(S) request.
  endpoint = new Url(endpointUrl);
  opts = endpoint.toOptions();
  opts.method = method;
  req = (endpoint.protocol === 'https:' ? https : http).request(opts);

  // Request response handler.
  if (handlers.data) {
    req.on('response', function (res) {
      // Attempt to follow Location: headers.
      var text, _ref;
      if (((_ref = res.statusCode) === 301 || _ref === 302 || _ref === 303) && res.headers['location']) {
        try {
          sendHttpRequest(method, res.headers['location'], mime, body, handlers);
        } catch (e) {

        }
        return;
      }

      // Read content.
      text = '';
      if (!(res.headers['content-type'] || res.headers['content-length'])) {
        handlers.data(0, text, res);
      }
      res.on('data', function (d) {
        return text += d;
      });
      return res.on('end', function () {
        return handlers.data(0, text, res);
      });
    });
  }

  // Send request.
  req.setHeader('Host', opts.hostname);
  req.setHeader('User-Agent', USER_AGENT);
  if (mime != null) {
    req.setHeader('Content-Type', mime);
  }
  if (body != null) {
    req.setHeader('Content-Length', body.length);
  }
  if ((_ref = handlers.headers) == null) {
    handlers.headers = function (req, next) {
      return next();
    };
  }
  // Header callback.
  handlers.headers(req, function () {
    if (body != null) {
      req.write(body);
    }
    return req.end();
  });

  // Return request emitter.
  return req;
};

/**
 * REM Classes.
 */

// Parsed hypermedia response and helper methods.

var HyperMedia = (function () {

  function HyperMedia (res, type, text) {
    this.res = res;
    this.type = type;
    this.text = text;
    this.statusCode = Number(this.res.statusCode);
    this.errorCode = this.statusCode > 400 ? this.statusCode : 0;

    // Parse body
    try {
      if (this.type === 'xml') {
        if (!libxmljs) {
          libxmljs = require('libxmljs');
        }
        this.data = this.xml = libxmljs.parseXmlString(this.text);
      } else {
        this.data = this.json = JSON.parse(this.text);
      }
    } catch (e) {

    }
  }

  /*
  	parseRate: ->
  		@rate =
  			limit: Number @res.headers['x-ratelimit-limit']
  			remaining: Number @res.headers['x-ratelimit-remaining']
  	
  	parseHrefs: ->
  		@hrefs = if @json.constructor == Array then [] else {}
  		iterateJSON @json, [], (obj, level) =>
  			if typeof obj == 'string' and obj.match /^https?:\/\/api\.tumblr\.com\//
  				cur = @hrefs
  				for k in level[0...-1]
  					unless cur[k]?
  						cur[k] = if String(Number(k)) == k then [] else {}
  					cur = cur[k]
  				cur[level[-1..][0]] = obj
  */

  return HyperMedia;

})();

// Route for a given path or URL.

var Route = (function () {

  function Route (url, defaultBodyMime, send) {
    this.url = url;
    this.defaultBodyMime = defaultBodyMime != null ? defaultBodyMime : 'form';
    this.send = send;
  }

  Route.prototype.get = function (query, next) {
    if (typeof query == 'function') {
      next = query;
      query = null;
    }
    var url = this.url.clone();
    Object.merge(url.query, query || {});
    return this.send('get', url.toString(), null, null, fn);
  };

  Route.prototype.head = function (query, next) {
    if (typeof query == 'function') {
      next = query;
      query = null;
    }
    url = this.url.clone();
    Object.merge(url.query, query || {});
    return this.send('head', url.toString(), null, null, fn);
  };

  Route.prototype.post = function (mime, data, next) {
    if (typeof query == 'function') {
      fn = query;
      query = null;
    }
    return this.send('post', this.url.toString(), mime != null ? mime : this.defaultBodyMime, data, fn);
  };

  Route.prototype.put = function () {
    var data, fn, mime, _arg, _i;
    _arg = 3 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 2) : (_i = 0, []), data = arguments[_i++], fn = arguments[_i++];
    mime = _arg[0];
    if (fn == null) {
      fn = null;
    }
    return this.send('put', this.url.toString(), mime != null ? mime : this.defaultBodyMime, data, fn);
  };

  Route.prototype["delete"] = function (fn) {
    if (fn == null) {
      fn = null;
    }
    return this.send('delete', this.url.toString(), null, null, fn);
  };

  return Route;

})();

// A REM API.

var API = (function () {

  function API (manifest, opts) {
    var _base, _ref, _ref1, _ref2,
      _this = this;
    this.manifest = manifest;
    this.opts = opts != null ? opts : {};

    // Load key, secret
    _ref = this.opts, this.key = _ref.key, this.secret = _ref.secret, this.format = _ref.format;

    // Load format-specific options.
    if ((_ref1 = this.format) == null) {
      this.format = 'json';
    }
    if ((_ref2 = (_base = this.manifest).formats) == null) {
      _base.formats = {
        json: {}
      };
    }
    if (!(this.manifest.formats[this.format] != null)) {
      throw new Error("Format \"" + this.format + "\" not available. Please specify an available format in the options parameter.");
    }
    this.manifest = Object.merge({}, this.manifest, this.manifest.formats[this.format] || {});

    // Add filter methods
    this.filters = [];
    if (this.manifest.basepath != null) {
      this.filters.push(function (endpoint) {
        return endpoint.pathname = _this.manifest.basepath + endpoint.pathname;
      });
    }
    if (this.manifest.suffix != null) {
      this.filters.push(function (endpoint) {
        return endpoint.pathname += _this.manifest.suffix;
      });
    }
    if (this.manifest.configParams != null) {
      this.filters.push(function (endpoint) {
        var ck, cv, _ref3, _results;
        _ref3 = _this.manifest.configParams;
        _results = [];
        for (ck in _ref3) {
          cv = _ref3[ck];
          _results.push(endpoint.query[ck] = _this.opts[cv]);
        }
        return _results;
      });
    }
    if (this.manifest.params != null) {
      this.filters.push(function (endpoint) {
        var qk, qv, _ref3, _results;
        _ref3 = _this.manifest.params;
        _results = [];
        for (qk in _ref3) {
          qv = _ref3[qk];
          _results.push(endpoint.query[qk] = qv);
        }
        return _results;
      });
    }
  }

  // Configuration prompt.

  API.prototype._promptConfig = false;

  API.prototype._persistConfig = false;

  API.prototype.prompt = function (_persistConfig) {
    this._persistConfig = _persistConfig != null ? _persistConfig : true;
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
    var args, query, url,
      _this = this;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (typeof args[args.length - 1] !== 'string') {
      query = args.pop();
    }
    url = new Url('');
    url.pathname = args.join('/');
    url.query = query || {};

    // Return a new route with data preparation.
    return new Route(url, this.manifest.uploadFormat, function (method, path, mime, body, cb) {
      if (cb == null) {
        cb = null;
      }

      // Expand payload shorthand.
      return _this.configure(function () {
        var base, endpoint, filter, patt, _i, _j, _len, _len1, _ref, _ref1, _ref2;
        if (typeof body === 'object') {
          _ref = (function () {
            switch (mime) {
              case 'form':
              case 'application/x-www-form-urlencoded':
                return ['application/x-www-form-urlencoded', querystring.stringify(body)];
              case 'json':
              case 'application/json':
                return ['application/json', safeJSONStringify(body)];
              default:
                return [mime, body];
            }
          })(), mime = _ref[0], body = _ref[1];
        }

        // Normalize path.
        path = path.replace(/^(?!\/)/, '/');

        // Determine base that matches path name.
        if (typeof _this.manifest.base === 'string') {
          base = _this.manifest.base;
        } else {
          base = '';
          _ref1 = _this.manifest.base;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            patt = _ref1[_i];
            if (typeof patt === 'string') {
              base = patt;
              break;
            }
            if (path.match(new RegExp(patt[0]))) {
              base = patt[1];
              break;
            }
          }
        }

        // Construct complete endpoint path.
        endpoint = new Url(base + path);
        // Apply manifest filters.
        _ref2 = _this.filters;
        for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
          filter = _ref2[_j];
          filter(endpoint);
        }

        // Process HTTP request through authentication scheme.
        _this.processRequest(method, endpoint.toString(), mime, body, function (err, data, res) {
          var media;
          // User callbacks.
          if (!cb) {
            return;
          }
          if (err) {
            return cb(err, null, null);
          } else {
            media = new HyperMedia(res, _this.format, data);
            return cb(media.errorCode, media.data, media);
          }
        });
      });
    });
  };

  API.prototype.processRequest = function (method, endpointUrl, mime, body, cb) {
    return sendHttpRequest(method, endpointUrl, mime, body, {
      data: cb
    });
  };

  // Root request shorthand.

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

var toughCookie = require('tough-cookie');
var Cookie = toughCookie.Cookie;
var CookieJar = toughCookie.CookieJar;

var CookieSessionAPI = (function (_super) {

  __extends(CookieSessionAPI, _super);

  function CookieSessionAPI (manifest, opts) {
    CookieSessionAPI.__super__.constructor.apply(this, arguments);
  }

  CookieSessionAPI.prototype.processRequest = function (method, endpointUrl, mime, body, cb) {
    // HTTP request.
    var _this = this;
    return sendHttpRequest(method, endpointUrl, mime, body, {
      data: cb,
      headers: function (req, next) {
        req.setHeader('Cookie', _this.opts.cookies);
        return next();
      }
    });
  };

  CookieSessionAPI.prototype.saveState = function (next) {
    return next({
      cookies: this.opts.cookies
    });
  };

  return CookieSessionAPI;

})(API);

var CookieSessionAuthentication = (function () {

  function CookieSessionAuthentication (api) {
    this.api = api;
  }

  CookieSessionAuthentication.prototype.authenticate = function (username, password, cb) {
    // HTTP request.
    var endpointUrl, jar,
      _this = this;
    jar = new CookieJar();
    endpointUrl = 'http://www.reddit.com/api/login';
    return sendHttpRequest('POST', endpointUrl, 'application/x-www-form-urlencoded', querystring.stringify({
      user: username,
      passwd: password
    }), {
      data: function (err, data, res) {
        // Read cookies.
        var cookie, cookies, deferred;
        if (res.headers['set-cookie'] instanceof Array) {
          cookies = res.headers['set-cookie'].map(Cookie.parse);
        } else if (res.headers['set-cookie'] != null) {
          cookies = [Cookie.parse(res.headers['set-cookie'])];
        }

        // Set cookies.
        return Q.all((function () {
          var _i, _len, _ref1, _ref2, _results;
          _ref1 = cookies || [];
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            cookie = _ref1[_i];
            if (!(_ref2 = cookie.key, __indexOf.call(this.api.manifest.auth.cookies, _ref2) >= 0)) {
              continue;
            }
            deferred = Q.defer();
            jar.setCookie(cookie, endpointUrl, function (err, r) {
              if (err) {
                return deferred.reject(err);
              } else {
                return deferred.resolve();
              }
            });
            _results.push(deferred.promise);
          }
          return _results;
        }).call(_this)).then(function () {
          return jar.getCookieString(endpointUrl, function (err, cookies) {
            return process.nextTick(function () {
              return _this.loadState({
                cookies: cookies
              }, cb);
            });
          });
        });
      }
    });
  };

  CookieSessionAuthentication.prototype.loadState = function (data, cb) {
    var opts;
    opts = JSON.clone(this.api.opts);
    opts.cookies = data.cookies;
    return cb(0, callable(new CookieSessionAPI(this.api.manifest, opts)));
  };

  return CookieSessionAuthentication;

})();

exports.session = function (api) {
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

var nodeoauth = require("oauth");

exports.oauth = function (api, callback) {
  switch (String(api.manifest.auth.version).toLowerCase()) {
    case '1.0':
    case '1.0a':
      return exports.oauth1(api, callback);
    case '2.0':
      return exports.oauth2(api, callback);
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

OAuth1API = (function (_super) {

  __extends(OAuth1API, _super);

  function OAuth1API(manifest, opts) {
    // Configuration.
    OAuth1API.__super__.constructor.apply(this, arguments);
    this.config = this.manifest.auth;
    this.oauth = new nodeoauth.OAuth(this.config.requestEndpoint, this.config.accessEndpoint, this.opts.key, this.opts.secret, this.config.version || '1.0', this.opts.oauthRedirect, "HMAC-SHA1", null, {
      'User-Agent': USER_AGENT,
      "Accept": "*/*",
      "Connection": "close"
    });
  }

  OAuth1API.prototype.saveState = function (next) {
    return next({
      oauthAccessToken: this.opts.oauthAccessToken,
      oauthAccessSecret: this.opts.oauthAccessSecret
    });
  };

  OAuth1API.prototype.saveSession = function (req, cb) {
    req.session.oauthAccessToken = this.opts.oauthAccessToken;
    req.session.oauthAccessSecret = this.opts.oauthAccessSecret;
    req.user = this;
    return cb(req);
  };

  OAuth1API.prototype.processRequest = function (method, endpointUrl, mime, body, cb) {
    // OAuth request.
    var payload, _ref1;
    payload = method === 'put' || method === 'post' ?
      // Signatures need to be calculated from forms; let node-oauth do that
      mime === 'application/x-www-form-urlencoded' ? [querystring.parse(body)] : [body, mime] : [];
    return (_ref1 = this.oauth)[method].apply(_ref1, [endpointUrl, this.opts.oauthAccessToken, this.opts.oauthAccessSecret].concat(__slice.call(payload), [cb]));
  };

  OAuth1API.prototype.validate = function (cb) {
    if (!this.config.validate) {
      throw new Error('Manifest does not define mechanism for validating OAuth.');
    }
    return this(this.config.validate).get(function (err, data) {
      return cb(err);
    });
  };

  return OAuth1API;

})(API);

OAuth1Authentication = (function () {

  function OAuth1Authentication(api, redirect) {
    this.api = api;
    if (redirect == null) {
      redirect = null;
    }
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
    var cb, params, _arg, _i,
      _this = this;
    _arg = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), cb = arguments[_i++];
    params = _arg[0];
    return this.api.configure(function () {
      _this.oauth = new nodeoauth.OAuth(_this.config.requestEndpoint, _this.config.accessEndpoint, _this.api.key, _this.api.secret, _this.config.version || '1.0', _this.oauthRedirect, "HMAC-SHA1", null, {
        'User-Agent': USER_AGENT,
        "Accept": "*/*",
        "Connection": "close"
      });

      // Filter parameters.
      params = Object.merge(params || {}, _this.config.params || {});
      if ((params.scope != null) && typeof params.scope === 'object') {
        params.scope = params.scope.join(_this.config.scopeSeparator || ' ');
      }
      // Needed for Twitter, etc.
      if (_this.oauthRedirect) {
        params['oauth_callback'] = _this.oauthRedirect;
      }
      return _this.oauth.getOAuthRequestToken(params, function (err, oauthRequestToken, oauthRequestSecret, results) {
        var authurl;
        if (err) {
          return console.error("Error requesting OAuth token: " + JSON.stringify(err));
        } else {
          authurl = new Url(_this.config.authorizeEndpoint);
          authurl.query.oauth_token = oauthRequestToken;
          if (_this.oauthRedirect) {
            authurl.query.oauth_callback = _this.oauthRedirect;
          }
          return cb(authurl.toString(), oauthRequestToken, oauthRequestSecret, results);
        }
      });
    });
  };

  OAuth1Authentication.prototype.complete = function () {
    var cb, oauthRequestSecret, oauthRequestToken, verifier, _arg, _i,
      _this = this;
    _arg = 4 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 3) : (_i = 0, []), oauthRequestToken = arguments[_i++], oauthRequestSecret = arguments[_i++], cb = arguments[_i++];
    verifier = _arg[0];
    if (!verifier && (!this.oob || this.config.oobVerifier)) {
      throw new Error('Out-of-band OAuth for this API requires a verification code.');
    }
    if (!this.oob) {
      verifier = new Url(verifier).query.oauth_verifier;
    }
    return this.oauth.getOAuthAccessToken(oauthRequestToken, oauthRequestSecret, verifier, function (err, oauthAccessToken, oauthAccessSecret, results) {
      if (err) {
        console.error("Error authorizing OAuth endpoint: " + JSON.stringify(err));
        return cb(err, null, results);
      } else {
        return _this.loadState({
          oauthAccessToken: oauthAccessToken,
          oauthAccessSecret: oauthAccessSecret,
          oauthRedirect: _this.oauthRedirect
        }, function (user) {
          return cb(err, user, results);
        });
      }
    });
  };

  OAuth1Authentication.prototype.loadState = function (data, next) {
    var opts;
    opts = JSON.clone(this.api.opts);
    opts.oauthAccessToken = data.oauthAccessToken;
    opts.oauthAccessSecret = data.oauthAccessSecret;
    opts.oauthRedirect = this.oauthRedirect;
    return next(callable(new OAuth1API(this.api.manifest, opts)));
  };

  OAuth1Authentication.prototype.startSession = function () {
    var cb, params, req, _arg, _i;
    req = arguments[0], _arg = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
    params = _arg[0];
    return this.start(params, function (url, oauthRequestToken, oauthRequestSecret, results) {
      req.session.oauthRequestToken = oauthRequestToken;
      req.session.oauthRequestSecret = oauthRequestSecret;
      return cb(url, results);
    });
  };

  OAuth1Authentication.prototype.clearSession = function (req, cb) {
    delete req.session.oauthAccessToken;
    delete req.session.oauthAccessSecret;
    delete req.session.oauthRequestToken;
    delete req.session.oauthRequestSecret;
    return cb();
  };

  OAuth1Authentication.prototype.loadSession = function (req, cb) {
    return this.loadState({
      oauthAccessToken: req.session.oauthAccessToken,
      oauthAccessSecret: req.session.oauthAccessSecret
    }, function (user) {
      req.user = user;
      return cb();
    });
  };

  OAuth1Authentication.prototype.middleware = function (cb) {
    var _this = this;
    path = new Url(this.oauthRedirect).pathname;
    return function (req, res, next) {
      if (req.path === path) {
        return _this.complete(req.url, req.session.oauthRequestToken, req.session.oauthRequestSecret, function (err, user, results) {
          return user.saveSession(req, function () {
            return cb(req, res, next);
          });
        });
      } else {
        if ((req.session.oauthAccessToken != null) && (req.session.oauthAccessSecret != null)) {
          return _this.loadSession(req, next);
        } else {
          return next();
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

// base

var OAuth2API = (function (_super) {

  __extends(OAuth2API, _super);

  function OAuth2API(manifest, opts) {
    // Constructor.
    OAuth2API.__super__.constructor.apply(this, arguments);
    this.config = this.manifest.auth;
    this.oauth = new nodeoauth.OAuth2(this.opts.key, this.opts.secret, this.config.base);
  }

  OAuth2API.prototype.processRequest = function (method, endpointUrl, mime, body, cb) {
    var payload, _ref1;
    payload = method === 'put' || method === 'post' ? [body, mime] : [];
    return (_ref1 = this.oauth)[method].apply(_ref1, [endpointUrl, this.opts.oauthAccessToken].concat(__slice.call(payload), [cb]));
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

  OAuth2API.prototype.saveSession = function (req, cb) {
    req.session.oauthAccessToken = this.opts.oauthAccessToken;
    req.session.oauthRefreshToken = this.opts.oauthRefreshToken;
    req.user = this;
    return cb(req);
  };

  return OAuth2API;

})(API);

var OAuth2Authentication = (function () {

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
    var cb, params, _arg, _i,
      _this = this;
    _arg = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), cb = arguments[_i++];
    params = _arg[0];
    return this.api.configure(function () {
      _this.oauth = new nodeoauth.OAuth2(_this.api.key, _this.api.secret, _this.config.base, _this.config.authorizePath, _this.config.tokenPath);
      params = Object.merge(_this.config.params || {}, params || {});
      if ((params.scope != null) && typeof params.scope === 'object') {
        params.scope = params.scope.join(_this.config.scopeSeparator || ' ');
      }
      params.redirect_uri = _this.oauthRedirect;
      return cb(_this.oauth.getAuthorizeUrl(params));
    });
  };

  OAuth2Authentication.prototype.complete = function () {
    var cb, secret, token, verifier, _arg, _i,
      _this = this;
    verifier = arguments[0], _arg = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
    token = _arg[0], secret = _arg[1];
    if (!this.oob) {
      verifier = new Url(verifier).query.code;
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
    var opts;
    opts = JSON.clone(this.api.opts);
    opts.oauthAccessToken = data.oauthAccessToken;
    opts.oauthRefreshToken = data.oauthRefreshToken;
    opts.oauthRedirect = this.oauthRedirect;
    return next(callable(new OAuth2API(this.api.manifest, opts)));
  };

  OAuth2Authentication.prototype.startSession = function () {
    // noop.
    var cb, params, req, _arg, _i;
    req = arguments[0], _arg = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
    params = _arg[0];
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
    path = new Url(this.oauthRedirect).pathname;
    return function (req, res, next) {
      if (req.path === path) {
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
  var api, cb, params, _arg, _i;
  api = arguments[0], _arg = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
  params = _arg[0];
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
        return cb(0, req.user);
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

AWSSignatureAPI = (function (_super) {
  var crypto;

  __extends(AWSSignatureAPI, _super);

  querystring = require('querystring');

  crypto = require('crypto');

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

})(API);

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

exports.API = API;

exports.create = function (manifest, opts) {
  return callable(new API(manifest, opts));
};

// TODO also load locally
exports.load = function (name, version, opts) {
  var manifest;
  if (version == null) {
    version = '1';
  }
  try {
    manifest = JSON.parse(fs.readFileSync(__dirname + '/common/' + name + '.json'))[version];
  } catch (e) {
    throw new Error('Unable to find API ' + name + '::' + version);
  }
  if (!(manifest != null)) {
    throw 'Manifest not found';
  }
  manifest.id = name;
  manifest.version = version;
  return exports.create(manifest, opts);
};

exports.url = function () {
  var args, query, url,
    _this = this;
  args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
  if (typeof args[args.length - 1] !== 'string') {
    query = args.pop();
  }
  url = new Url(args.join('/'));
  Object.merge(url.query, query || {});
  return new Route(url, 'form', function (method, url, mime, body, cb) {
    if (cb == null) {
      cb = null;
    }
    return sendHttpRequest(method, url, mime, body, cb ? {
      data: cb
    } : {});
  });
};