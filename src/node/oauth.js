var util = require('util');
var fs = require('fs');
var path = require('path');

var async = require('async');
var read = require('read');
var connect = require('connect');
var nconf = require('nconf');
var osenv = require('osenv');
var querystring = require('querystring');
require('colors');

// Namespace.
var rem = require('../rem');


/**
 * Utilities
 */

function callable (obj) {
  var f = function () {
    return f.call.apply(f, arguments);
  };
  f.__proto__ = obj;
  return f;
};

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
}

function augment (c, b) {
  for (var k in b) {
    if (Object.prototype.hasOwnProperty.call(b, k) && b[k] != null) {
      c[k] = b[k];
    }
  }
  return c;
}


/**
 * OAuth.
 */

// version = '1.0', '1.0a', '2.0'
// scopeSeparator
// validate
// oob
// oobCallback
// oobVerifier

rem.oauth = function (api, callback) {;
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

  util.inherits(OAuth1API, rem.ManifestClient);

  function OAuth1API (manifest, options) {
    rem.ManifestClient.apply(this, arguments);

    this.config = this.manifest.auth;
    this.oauth = new nodeoauth.OAuth(this.config.requestEndpoint,
      this.config.accessEndpoint, this.options.key, this.options.secret,
      this.config.version || '1.0', this.options.oauthRedirect, "HMAC-SHA1", null, {
        'User-Agent': rem.USER_AGENT,
        "Accept": "*/*",
        "Connection": "close"
      });
  }

  OAuth1API.prototype.send = function (req, stream, next) {
    if (!req.awaitingStream()) {
      withBody.call(this, req.body);
    } else {
      stream.input.on('end', function () {
        withBody.call(this, stream.input.toBuffer());
      }.bind(this));
      stream.input.cache = true;
      stream.input.resume();
    }

    function withBody (body) {
      req.body = body;

      // OAuth request.
      var args = [String(req.url), this.options.oauthAccessToken, this.options.oauthAccessSecret];
      var passDirectly = false;
      if (req.method === 'PUT' || req.method === 'POST' || req.method == 'PATCH') {
        // Signatures need to be calculated from forms; let node-oauth do that
        if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
          args.push(querystring.parse(String(req.body)));
        } else if (rem.env.isList(req.body)) {
          // node-oauth doesn't support binary uploads. Horrible hacks ahoy.
          passDirectly = true;
          if (!Buffer._byteLength) {
            Buffer._byteLength = Buffer.byteLength;
          }
          Buffer.byteLength = function (arg) {
            return arg === req.body ? req.body.length : Buffer._byteLength(arg);
          };
        } else {
          args.push(String(req.body), req.headers['content-type']);
        }
      }

      // TODO support close early code from https://github.com/ciaranj/node-oauth/blob/master/lib/oauth.js#L349
      // Buffers need to be passed directly to code, we let node-oauth handle strings otherwise.
      if (passDirectly) {
        var oauthreq = this.oauth._performSecureRequest( this.options.oauthAccessToken, this.options.oauthAccessSecret, req.method, String(req.url), null, req.body, req.headers['content-type']);
      } else {
        var oauthreq = this.oauth[req.method.toLowerCase()].apply(this.oauth, args)
      }
      oauthreq.on('response', function (res) {
        next(null, res);
      }).on('error', function (err) {
        next(err, null);
      }).end();
    }
  };

  OAuth1API.prototype.saveState = function (next) {
    return next({
      oauthAccessToken: this.options.oauthAccessToken,
      oauthAccessSecret: this.options.oauthAccessSecret
    });
  };

  OAuth1API.prototype.saveSession = function (req, next) {
    req.session[this.manifest.id + ':oauthAccessToken'] = this.options.oauthAccessToken;
    req.session[this.manifest.id + ':oauthAccessSecret'] = this.options.oauthAccessSecret;
    return next(req);
  };

  OAuth1API.prototype.validate = function (next) {
    if (!this.config.validate) {
      throw new Error('Manifest does not define mechanism for validating OAuth.');
    }
    this(this.config.validate).get(function (err, data) {
      next(!err);
    });
  };

  return OAuth1API;

})();

var OAuth1Authentication = (function () {

  var nodeoauth = require("oauth");

  function OAuth1Authentication(api, redirect) {
    this.api = api;
    this.config = this.api.manifest.auth;

    // Get redirect URL.
    this.oob = !redirect;
    this.oauthRedirect = this.oob ? this.config.oobCallback : redirect;
  }

  OAuth1Authentication.prototype.start = function () {
    var args = Array.prototype.slice.call(arguments);
    var next = args.pop();
    var params = args.pop();

    this.oauth = new nodeoauth.OAuth(this.config.requestEndpoint, 
      this.config.accessEndpoint, this.api.options.key, this.api.options.secret,
      this.config.version || '1.0', this.oauthRedirect, "HMAC-SHA1", null, {
        'User-Agent': rem.USER_AGENT,
        "Accept": "*/*",
        "Connection": "close"
      });

    // Filter parameters.
    params = augment(params || {}, this.config.params || {});
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
        var authurl = new rem.URL(this.config.authorizeEndpoint);
        authurl.query.oauth_token = oauthRequestToken;
        if (this.oauthRedirect) {
          authurl.query.oauth_callback = this.oauthRedirect;
        }
        next(String(authurl), oauthRequestToken, oauthRequestSecret, results);
      }
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
      verifier = new rem.URL(verifier).query.oauth_verifier;
    }

    var oauth = this;
    return this.oauth.getOAuthAccessToken(oauthRequestToken, oauthRequestSecret, verifier,
      function (err, oauthAccessToken, oauthAccessSecret, results) {
        if (err) {
          console.error("Error authorizing OAuth endpoint: " + JSON.stringify(err));
          next(err, null, results);
        } else {
          next(err, oauth.restore({
            oauthAccessToken: oauthAccessToken,
            oauthAccessSecret: oauthAccessSecret,
            oauthRedirect: oauth.oauthRedirect
          }), results);
        }
      });
  };

  OAuth1Authentication.prototype.restore = function (data) {
    var options = clone(this.api.options);
    options.oauthAccessToken = data.oauthAccessToken;
    options.oauthAccessSecret = data.oauthAccessSecret;
    options.oauthRedirect = this.oauthRedirect;
    return callable(new OAuth1API(this.api.manifest, options));
  };

  OAuth1Authentication.prototype.startSession = function (req) {
    var args = Array.prototype.slice.call(arguments, 1);
    var next = args.pop();
    var params = args.pop();

    this.start(params, function (url, oauthRequestToken, oauthRequestSecret, results) {
      req.session[this.api.manifest.id + ':oauthRequestToken'] = oauthRequestToken;
      req.session[this.api.manifest.id + ':oauthRequestSecret'] = oauthRequestSecret;
      next(url, results);
    }.bind(this));
  };

  OAuth1Authentication.prototype.clearSession = function (req, next) {
    delete req.session[this.api.manifest.id + ':oauthAccessToken'];
    delete req.session[this.api.manifest.id + ':oauthAccessSecret'];
    delete req.session[this.api.manifest.id + ':oauthRequestToken'];
    delete req.session[this.api.manifest.id + ':oauthRequestSecret'];
    next();
  };

  OAuth1Authentication.prototype.session = function (req) {
    if (req.session[this.api.manifest.id + ':oauthAccessToken']
      && req.session[this.api.manifest.id + ':oauthAccessSecret']) {
      return this.restore({
        oauthAccessToken: req.session[this.api.manifest.id + ':oauthAccessToken'],
        oauthAccessSecret: req.session[this.api.manifest.id + ':oauthAccessSecret']
      });
    }
    return null;
  };

  OAuth1Authentication.prototype.middleware = function (callback) {
    var pathname = new rem.URL(this.oauthRedirect).pathname;

    var auth = this;
    return function (req, res, next) {
      var url = new rem.URL(req.url);
      if (url.pathname === pathname) {
        if (!auth.oauth) {
          res.writeHead(302, {
            'Location': '/'
          });
          res.end();
          return;
        }
        auth.complete(req.url,
          req.session[auth.api.manifest.id + ':oauthRequestToken'],
          req.session[auth.api.manifest.id + ':oauthRequestSecret'],
          function (err, user, results) {
            user.saveSession(req, function () {
              callback(req, res, next);
            });
          });
      } else {
        next();
      }
    };
  };

  // Convenience functions.

  OAuth1Authentication.prototype.login = function (opts) {
    return function (req, res) {
      this.startSession(req, opts || {}, function (url) {
        res.redirect(url);
      });
    }.bind(this);
  };

  OAuth1Authentication.prototype.logout = function (callback) {
    return function (req, res) {
      this.clearSession(req, callback.bind(this, req, res, next));
    }.bind(this);
  };

  return OAuth1Authentication;

})();

rem.oauth1 = function (api, callback) {
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
  //  header['User-Agent'] = rem.USER_AGENT
  //  oldreq.call this, method, url, headers, body, accessToken, cb
  // OAuth2::get = (url, accessToken, body, mime, cb) ->
  //  @_request "GET", url, {}, "", accessToken, cb
  nodeoauth.OAuth2.prototype.post = function (url, accessToken, body, mime, cb) {
    return this._request("POST", url, {
      "content-type": mime
    }, body, accessToken, cb);
  };
  nodeoauth.OAuth2.prototype.put = function (url, accessToken, body, mime, cb) {
    // node-oauth expects a method of "POST" for a body.
    // This is a terrible, terrible temporary hack.
    var method = {
      toString: function () { return 'PUT'; },
      valueOf: function () { return 'POST'; },
      toUpperCase: function () { return method; }
    };
    return this._request(method, url, {
      "content-type": mime
    }, body, accessToken, cb);
  };
  nodeoauth.OAuth2.prototype['head'] = function (url, accessToken, cb) {
    return this._request("HEAD", url, {}, "", accessToken, cb);
  };
  nodeoauth.OAuth2.prototype['delete'] = function (url, accessToken, cb) {
    return this._request("DELETE", url, {}, "", accessToken, cb);
  };
  nodeoauth.OAuth2.prototype['patch'] = function (url, accessToken, body, mime, cb) {
    // node-oauth expects a method of "POST" for a body.
    // This is a terrible, terrible temporary hack.
    var method = {
      toString: function () { return 'PATCH'; },
      valueOf: function () { return 'POST'; },
      toUpperCase: function () { return method; }
    };
    return this._request(method, url, {
      "content-type": mime
    }, body, accessToken, cb);
  };

  util.inherits(OAuth2API, rem.ManifestClient);

  function OAuth2API(manifest, options) {
    // Constructor.
    rem.ManifestClient.apply(this, arguments);
    this.config = this.manifest.auth;
    this.oauth = new nodeoauth.OAuth2(this.options.key, this.options.secret, this.config.base);
    if (this.config.accessTokenParam) {
      this.oauth._accessTokenName = this.config.accessTokenParam;
    }

    // Convenience functions.
    this.login = function (req, res) {
      this.startSession(req, function (url) {
        res.redirect(url);
      });
    }.bind(this);
  }

  OAuth2API.prototype.send = function (req, stream, next) {
    if (!req.awaitingStream()) {
      withBody.call(this, req.body);
    } else {
      stream.input.on('end', function () {
        withBody.call(this, stream.input.toBuffer());
      }.bind(this));
      stream.input.cache = true;
      stream.input.resume();
    }

    function withBody (body) {
      req.body = body;

      // OAuth request.
      var args = [String(req.url), this.options.oauthAccessToken];
      if (req.method === 'PUT' || req.method === 'POST' || req.method == 'PATCH') {
        args.push(req.body, req.getHeader('content-type'));
      }

      if (rem.env.isList(req.body)) {
        // node-oauth doesn't support binary uploads. Horrible hacks ahoy.
        if (!Buffer._byteLength) {
          Buffer._byteLength = Buffer.byteLength;
        }
        Buffer.byteLength = function (arg) {
          return arg === req.body ? req.body.length : Buffer._byteLength(arg);
        };
      }

      // TODO node-oauth OAuth2 support doesn't let you return streams.
      this.oauth._customHeaders = req.headers;
      this.oauth[req.method.toLowerCase()].apply(this.oauth, args.concat([function (err, data) {
        var stream = new (require('stream')).Stream();
        stream.url = String(req.url);
        stream.headers = {};

        // node-oauth will send a status code in the error object.
        if (err && typeof err == 'object' && err.statusCode) {
          stream.statusCode = err.statusCode;
          next(null, stream);
        } else if (typeof err != 'object') {
          // Assuming a client-side error.
          next(err);
        } else {
          // Assuming a 200 status code.
          stream.statusCode = 200;
          next(null, stream);
        }

        // Error objects with node-oauth bundle the content inside.
        if (err && typeof err == 'object') {
          data = err.data;
        }
        stream.emit('data', data);
        stream.emit('end');
      }]));
    };
  };

  OAuth2API.prototype.validate = function (next) {
    if (!this.config.validate) {
      throw new Error('Manifest does not define mechanism for validating OAuth.');
    }
    this(this.config.validate).get(function (err, data) {
      next(!err);
    });
  };

  OAuth2API.prototype.saveState = function (next) {
    return next({
      oauthRedirect: this.options.oauthRedirect,
      oauthAccessToken: this.options.oauthAccessToken,
      oauthRefreshToken: this.options.oauthRefreshToken
    });
  };

  OAuth2API.prototype.saveSession = function (req, next) {
    req.session[this.manifest.id + ':oauthAccessToken'] = this.options.oauthAccessToken;
    req.session[this.manifest.id + ':oauthRefreshToken'] = this.options.oauthRefreshToken;
    return next(req);
  };

  return OAuth2API;

})();

var OAuth2Authentication = (function () {

  var nodeoauth = require("oauth");

  function OAuth2Authentication(api, redirect) {
    this.api = api;
    this.config = this.api.manifest.auth;

    // Get redirect URL.
    this.oob = !redirect;
    this.oauthRedirect = this.oob ? this.config.oobCallback : redirect;
  }

  OAuth2Authentication.prototype.start = function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = args.pop();
    var params = args.pop();

    var cb, params, _arg, _i;
    var _this = this;
    _this.oauth = new nodeoauth.OAuth2(_this.api.options.key, _this.api.options.secret,
      _this.config.base, _this.config.authorizePath, _this.config.tokenPath);
    params = augment(_this.config.params || {}, params || {});
    if ((params.scope != null) && typeof params.scope === 'object') {
      params.scope = params.scope.join(_this.config.scopeSeparator || ' ');
    }
    params.redirect_uri = _this.oauthRedirect;
    return cb(_this.oauth.getAuthorizeUrl(params));
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
      verifier = new rem.URL(verifier).query.code;
    }
    return this.oauth.getOAuthAccessToken(verifier, {
      redirect_uri: this.oauthRedirect,
      grant_type: 'authorization_code'
    }, function (err, oauthAccessToken, oauthRefreshToken) {
      if (err) {
        console.error('Error authorizing OAuth2 endpoint:', JSON.stringify(err));
        return cb(err, null);
      } else {
        cb(null, _this.restore({
          oauthAccessToken: oauthAccessToken,
          oauthRefreshToken: oauthRefreshToken
        }));
      }
    });
  };

  OAuth2Authentication.prototype.restore = function (data) {
    var options = clone(this.api.options);
    options.oauthAccessToken = data.oauthAccessToken;
    options.oauthRefreshToken = data.oauthRefreshToken;
    options.oauthRedirect = this.oauthRedirect;
    return callable(new OAuth2API(this.api.manifest, options));
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
    delete req.session[this.api.manifest.id + ':oauthAccessToken'];
    delete req.session[this.api.manifest.id + ':oauthRefreshToken'];
    return cb();
  };

  OAuth2Authentication.prototype.session = function (req) {
    if (req.session[this.api.manifest.id + ':oauthAccessToken']) {
      return this.restore({
        oauthAccessToken: req.session[this.api.manifest.id + ':oauthAccessToken'],
        oauthRefreshToken: req.session[this.api.manifest.id + ':oauthRefreshToken']
      });
    }
    return null;
  };

  OAuth2Authentication.prototype.middleware = function (callback) {
    var pathname = new rem.URL(this.oauthRedirect).pathname;

    var auth = this;
    return function (req, res, next) {
      var url = new rem.URL(req.url);
      if (url.pathname === pathname) {
        if (!auth.oauth) {
          res.writeHead(302, {
            'Location': '/'
          });
          res.end();
          return;
        }
        auth.complete(req.url, function (err, user, results) {
          user.saveSession(req, function () {
            callback(req, res, next);
          });
        });
      } else {
        next();
      }
    };
  };

  // Convenience functions.

  OAuth2Authentication.prototype.login = function (opts) {
    return function (req, res) {
      this.startSession(req, opts || {}, function (url) {
        res.redirect(url);
      });
    }.bind(this);
  };

  OAuth2Authentication.prototype.logout = function (callback) {
    return function (req, res, next) {
      this.clearSession(req, callback.bind(this, req, res, next));
    }.bind(this);
  };

  return OAuth2Authentication;

})();

rem.oauth2 = function (api, callback) {
  return new OAuth2Authentication(api, callback);
};

/**
 * Oauth console.
 */

rem.promptOAuthOob = function () {
  var args = Array.prototype.slice.call(arguments);
  var cb = args.pop();
  var api = args.shift();
  var params = args.pop(); // optional

  // Check that oob is allowed.
  var oauth = rem.oauth(api);
  if (!api.config.oob) {
    throw new Error('Out-of-band OAuth for this API is not permitted.');
  }

  // Out-of-band authentication.
  oauth.start(function (url, token, secret) {
    console.error(("To authenticate, open this URL:").yellow, url);
    if (api.manifest.auth.oobVerifier) {
      read({
        prompt: ("Type in the verification code: ").yellow
      }, function (err, verifier) {
        oauth.complete(verifier, token, secret, cb);
      });
    } else {
      read({
        prompt: ("Hit any key to continue...").yellow
      }, function (err) {
        console.error("");
        oauth.complete(token, secret, cb);
      });
    }
  });
};

function similar (a, b) {
  return JSON.stringify(a) == JSON.stringify(b);
}

rem.promptOAuth = function (/* api, [params,] callback */) {
  var args = Array.prototype.slice.call(arguments);
  var cb = args.pop(), api = args.shift(), params = args.pop() || {};

  var oauth, port = (params && params.port) || 3000;
    
  // Authenticated API.
  oauth = rem.oauth(api, "http://localhost:" + port + "/oauth/callback/");

  // Check config for cached credentials, ensuring parameters are the same.
  var cred = rem.env.config.get(api.manifest.id + ':auth');
  if (cred && similar(cred.params || {}, params)) {
    var user = oauth.restore(cred);
    user.validate(function (validated) {
      if (!validated) {
        requestCredentials();
      } else {
        console.error(("Loaded API authentication credentials from " + rem.env.config.stores.file.file).yellow);
        cb(null, user);
      }
    });
  } else {
    requestCredentials();
  }

  function requestCredentials () {
    // Create OAuth server configuration.
    var app = connect();

    app
      .use(connect.cookieParser())
      .use(connect.cookieSession({
        secret: String(Math.random())
      }));

    // OAuth callback.
    app.use(oauth.middleware(function (req, res, next) {
      // Save to nconf.
      var user = oauth.session(req);
      user.saveState(function (state) {
        state.params = params;
        rem.env.config.set(api.manifest.id + ':auth', state);
        rem.env.config.save();

        // Respond.
        res.end("<h1>OAuthenticated.</h1><p>Return to your console, hero!</p>");
        console.error("");

        // Close server and invoke callback on next event loop.
        process.nextTick(function () {
          req.connection.destroy()
          server.close();
          cb(null, user);
        });
      });
    }));
    // Login page.
    app.use(function (req, res, next) {
      if (req.url == '/') {
        oauth.startSession(req, params || {}, function (url) {
          res.writeHead(302, {
            'Location': String(url)
          });
          res.end();
        });
      } else {
        next();
      }
    });
    // The rest.
    app.use(function (req, res) {
      res.statusCode = 404;
      res.end('404 Not found: ' + req.url);
    })

    // Listen on server.
    var server = require('http').createServer(app);
    server.listen(port);
    console.error(("Ensure your API's callback URL is set to " + oauth.oauthRedirect).yellow);
    console.error(("To authenticate, open this URL:").yellow, "http://localhost:" + port + "/");
  }
};