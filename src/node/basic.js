var util = require('util');
var fs = require('fs');
var path = require('path');

var async = require('async');
var read = require('read');
var nconf = require('nconf');
var osenv = require('osenv');

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

/**
 * Cookie authentication.
 */

var CookieSessionAPI = (function () {

  util.inherits(CookieSessionAPI, rem.ManifestClient);

  function CookieSessionAPI (options) {
    rem.ManifestClient.apply(this, arguments);

    this.use(function (req, next) {
      req.headers['cookie'] = this.options.cookies;
      next();
    });
  }

  CookieSessionAPI.prototype.saveState = function (next) {
    return next({
      cookies: this.options.cookies
    });
  };

  return CookieSessionAPI;

})();

var CookieSessionAuthentication = (function () {

  var toughCookie = require('tough-cookie'),
    Cookie = toughCookie.Cookie,
    CookieJar = toughCookie.CookieJar;
  var querystring = require('querystring');

  function CookieSessionAuthentication (api) {
    this.api = api;
    this.config = api.manifest.auth;
  }

  CookieSessionAuthentication.prototype.authenticate = function (username, password, callback) {
    // Payload.
    var payload = {}, source = {username: username, password: password};
    for (var key in this.config.payload) {
      payload[key] = source[this.config.payload[key]];
    }

    // Request.
    rem.text(this.config.loginEndpoint).post('form', payload, function (err, stream, res) {
      if (err) {
        callback(err, null);
      }

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
        return (this.api.manifest.auth.cookies || []).indexOf(cookie.key) != -1;
      }.bind(this)), function (cookie, next) {
        jar.setCookie(cookie, res.url, next);
      }, function (err) {
        if (err) {
          validateSession(err);
        } else {
          jar.getCookieString(res.url, function (err, cookies) {
            var user = this.restore({cookies: cookies});
            validateSession(null, user);
          }.bind(this))
        }
      }.bind(this));
    }.bind(this));

    function validateSession(err, user) {
      /*
      TODO
      if (!err) {
        user.validate(function (validated) {
          callback(!validated, user);
        })
      } else {
        callback(err, user);
      }
      */
      callback(err, user);
    }
  };

  CookieSessionAuthentication.prototype.restore = function (data) {
    var options = clone(this.api.options);
    options.cookies = data.cookies;
    return callable(new CookieSessionAPI(this.api.manifest, options));
  };

  return CookieSessionAuthentication;

})();

/**
 * HTTP Sessions.
 */

rem.basicAuth = function (api) {
  return new CookieSessionAuthentication(api);
};

rem.promptBasicAuth = function (api, opts, next) {
  if (!next) next = opts, opts = {};

  var read = require('read');
  require('colors');

  var session = rem.basicAuth(api);
  read({prompt: ('Username: ').yellow}, function (err, user) {
    read({prompt: ('Password: ').yellow, silent: true}, function (err, password) {
      console.log('');
      session.authenticate(user, password, next);
    });
  });
};