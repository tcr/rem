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
var rem = require('./rem');
var remutil = require('./remutil');

/**
 * Cookie authentication.
 */

var CookieSessionAPI = (function () {

  util.inherits(CookieSessionAPI, rem.API);

  function CookieSessionAPI (manifest, opts) {
    API.apply(this, arguments);

    this.pre('request', function (req, next) {
      req.headers['cookie'] = this.opts.cookies;
      next();
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
    return cb(null, remutil.callable(new CookieSessionAPI(this.api.manifest, opts)));
  };

  return CookieSessionAuthentication;

})();

/**
 * HTTP Sessions.
 */

rem.session = function (api) {
  return new CookieSessionAuthentication(api);
};