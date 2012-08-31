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
var remutil = exports;

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

remutil.consumeStream = function (stream, next) {
  var buf = [];
  stream.on('data', function (data) {
    buf.push(data);
  });
  stream.on('end', function () {
    next(Buffer.concat(buf));
  });
}

remutil.safeJSONStringify = function (s) {
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
          'User-Agent': rem.USER_AGENT
        },
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
          body = querystring.stringify(body);
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
 * Query string parsing.
 */

remutil.qs = require('querystring');

/**
 * Path parsing.
 */

remutil.path = require('path');

/**
 * Inheritance.
 */

remutil.inherits = function (ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false
    }
  });
};

/** 
 * Manifest lookup.
 */

remutil.lookup = function (name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../common', name + '.json')));
  } catch (e) {
    return null;
  }
};