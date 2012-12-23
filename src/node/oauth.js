var util = require('util');
var fs = require('fs');
var path = require('path');

var async = require('async');
var read = require('read');
var connect = require('connect');
var nconf = require('nconf');
var osenv = require('osenv');
var clc = require('cli-color');
var querystring = require('querystring');

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

  OAuth1API.prototype.send = function (req, next) {
    // OAuth request.
    var args = [rem.env.url.format(req.url), this.options.oauthAccessToken, this.options.oauthAccessSecret];
    if (req.method === 'PUT' || req.method === 'POST') {
      // Signatures need to be calculated from forms; let node-oauth do that
      if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        args.push(querystring.parse(String(req.body)));
      } else {
        args.push(String(req.body), req.headers['content-type']);
      }
    }

    // TODO support close early code from https://github.com/ciaranj/node-oauth/blob/master/lib/oauth.js#L349
    //this.oauth[req.method.toLowerCase()].apply(this.oauth, args.concat([next]));
    var oauthreq = this.oauth[req.method.toLowerCase()].apply(this.oauth, args)
    oauthreq.on('response', function (res) {
      next(null, res);
    }).on('error', function (err) {
      next(err, null);
    }).end();
  };

  OAuth1API.prototype.saveState = function (next) {
    return next({
      oauthAccessToken: this.options.oauthAccessToken,
      oauthAccessSecret: this.options.oauthAccessSecret
    });
  };

  OAuth1API.prototype.saveSession = function (req, next) {
    req.session.oauthAccessToken = this.options.oauthAccessToken;
    req.session.oauthAccessSecret = this.options.oauthAccessSecret;
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
    this.config = this.api.manifest.auth;

    // Get redirect URL.
    this.oob = !redirect;
    this.oauthRedirect = this.oob ? this.config.oobCallback : redirect;

    api.pre('configure', function (next) {
      console.error(clc.yellow("Your callback URL should be set to " + this.oauthRedirect + ', or some valid URL.'));
      next();
    }.bind(this));
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
        var authurl = rem.env.url.parse(this.config.authorizeEndpoint);
        authurl.query.oauth_token = oauthRequestToken;
        if (this.oauthRedirect) {
          authurl.query.oauth_callback = this.oauthRedirect;
        }
        next(rem.env.url.format(authurl), oauthRequestToken, oauthRequestSecret, results);
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
      verifier = rem.env.url.parse(verifier).query.oauth_verifier;
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
    var options = clone(this.api.options);
    options.oauthAccessToken = data.oauthAccessToken;
    options.oauthAccessSecret = data.oauthAccessSecret;
    options.oauthRedirect = this.oauthRedirect;
    return next(callable(new OAuth1API(this.api.manifest, options)));
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
    var pathname = rem.env.url.parse(this.oauthRedirect).pathname;

    var auth = this;
    return function (req, res, next) {
      var url = rem.env.url.parse(req.url);
      if (url.pathname === pathname) {
        if (!auth.oauth) {
          return res.redirect('/');
        }
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
    return this._request("PUT", url, {
      "content-type": mime
    }, body, accessToken, cb);
  };
  nodeoauth.OAuth2.prototype["delete"] = function (url, accessToken, body, mime, cb) {
    return this._request("DELETE", url, {}, "", accessToken, cb);
  };

  util.inherits(OAuth2API, rem.ManifestClient);

  function OAuth2API(manifest, options) {
    // Constructor.
    rem.ManifestClient.apply(this, arguments);
    this.config = this.manifest.auth;
    this.oauth = new nodeoauth.OAuth2(this.options.key, this.options.secret, this.config.base);
  }

  OAuth2API.prototype.send = function (req, next) {
    // OAuth request.
    var args = [rem.env.url.format(req.url), this.options.oauthAccessToken];
    if (req.method === 'PUT' || req.method === 'POST') {
      args.push(String(req.body), req.headers['content-type']);
    }

    // TODO node-oauth OAuth2 support doesn't let you return streams.
    // Fix this sometime when I have the energy.
    this.oauth[req.method.toLowerCase()].apply(this.oauth, args.concat([function (err, data) {
      var stream = new (require('stream')).Stream();

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

  OAuth2API.prototype.validate = function (cb) {
    if (!this.config.validate) {
      throw new Error('Manifest does not define mechanism for validating OAuth.');
    }
    return this(this.config.validate).get(function (err, data) {
      return cb(err);
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
    req.session.oauthAccessToken = this.options.oauthAccessToken;
    req.session.oauthRefreshToken = this.options.oauthRefreshToken;
    req.user = this;
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

    api.pre('configure', function (next) {
      console.error(clc.yellow("Your callback URL should be set to " + this.oauthRedirect + ', or some valid URL.'));
      next();
    }.bind(this));
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
      verifier = rem.env.url.parse(verifier).query.code;
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
    var options = clone(this.api.options);
    options.oauthAccessToken = data.oauthAccessToken;
    options.oauthRefreshToken = data.oauthRefreshToken;
    options.oauthRedirect = this.oauthRedirect;
    return next(callable(new OAuth2API(this.api.manifest, options)));
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
    var pathname = rem.env.url.parse(this.oauthRedirect).pathname;
    return function (req, res, next) {
      if (req.path === pathname) {
        if (!_this.oauth) {
          return res.redirect('/');
        }
        _this.complete(req.url, function (err, user, results) {
          user.saveSession(req, function () {
            cb(req, res, next);
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

rem.oauth2 = function (api, callback) {
  return new OAuth2Authentication(api, callback);
};

/**
 * Oauth console.
 */

rem.oauthConsoleOob = function () {
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
    console.error(clc.yellow("To authenticate, visit: " + url));
    if (api.manifest.auth.oobVerifier) {
      read({
        prompt: clc.yellow("Type in the verification code: ")
      }, function (err, verifier) {
        oauth.complete(verifier, token, secret, cb);
      });
    } else {
      read({
        prompt: clc.yellow("Hit any key to continue...")
      }, function (err) {
        console.error("");
        oauth.complete(token, secret, cb);
      });
    }
  });
};

rem.promptOauth = function () {
  var args = Array.prototype.slice.call(arguments);
  var cb = args.pop();
  var api = args.shift();
  var params = args.pop(); // optional

  var oauth, port = (params && params.port) || 3000;
    
  // Authenticated API.
  oauth = rem.oauth(api, "http://localhost:" + port + "/oauth/callback/");

  // Check config for cached credentials.
  var cred = rem.env.config.get(api.manifest.id + ':oauth');
  if (cred) {
    return oauth.loadState(cred, function (user) {
      user.validate(function (validated) {
        if (validated) {
          requestCredentials();
        } else {
          console.error(clc.yellow("Using credentials stored in " + rem.env.config.stores.file.file));
          console.error("");
          cb(null, user);
        }
      })
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
        secret: "!"
      }));

    // OAuth callback.
    app.use(oauth.middleware(function (req, res, next) {
      // Save to nconf.
      req.user.saveState(function (state) {
        rem.env.config.set(api.manifest.id + ':oauth', state);
        rem.env.config.save();

        // Respond.
        res.end("<h1>Oauthenticated.</h1><p>Return to your console, hero!</p><p>To restart authentication, refresh the page.</p>");
        console.error("");
        process.nextTick(function () {
          cb(null, req.user);
        });
      });
    }));

    // Login page.
    app.use(function (req, res, next) {
      if (req.url == '/') {
        oauth.startSession(req, params || {}, function (url) {
          res.writeHead(302, {
            'Location': url
          });
          res.end();
        });
      } else {
        next();
      }
    });
    // Listen on server.
    app.listen(port);
    console.error(clc.yellow("To authenticate, visit: http://localhost:" + port + "/"));
  }
};