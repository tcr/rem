var util = require('util');
var fs = require('fs');
var path = require('path');

var async = require('async');
var read = require('read');
var express = require('express');
var nconf = require('nconf');
var osenv = require('osenv');
var clc = require('cli-color');

// Namespace.
var rem = require('../rem');

/**
 * Utilities
 */

function callable (obj) {
  var f = function () {
    return f.invoke.apply(f, arguments);
  };
  for (var key in obj) {
    f[key] = obj[key];
  }
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

    this.pre('request', function (req, next) {
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
  }

  CookieSessionAuthentication.prototype.authenticate = function (username, password, callback) {
    // Create our request.
    (new rem.Client({
      uploadFormat: 'form'
    })).text('http://www.reddit.com/api/login').post({
      user: username,
      passwd: password
    }, function (err, stream, res) {
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
            this.loadState({cookies: cookies}, validateSession);
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

  CookieSessionAuthentication.prototype.loadState = function (data, cb) {
    var options = clone(this.api.options);
    options.cookies = data.cookies;
    return cb(null, callable(new CookieSessionAPI(this.api.manifest, options)));
  };

  return CookieSessionAuthentication;

})();

/**
 * HTTP Sessions.
 */

rem.session = function (api) {
  return new CookieSessionAuthentication(api);
};

rem.promptSession = function (api, next) {
  var read = require('read');
  var clc = require('cli-color');

  var session = rem.session(api);
  read({prompt: clc.yellow('Username: ')}, function (err, user) {
    read({prompt: clc.yellow('Password: '), silent: true}, function (err, password) {
      console.log('');
      session.authenticate(user, password, next);
    });
  });
};