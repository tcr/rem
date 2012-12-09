/*

Rem: REST easy.
A flexible HTTP library for using the web like an API.

Reference:
http://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven

*/

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

function modify (a, b) {
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
}

var envtype = (typeof module !== 'undefined' && module.exports) ? 'node' : 'browser';

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
 * Module
 */

var rem = (envtype == 'node') ? exports ? this.rem = {};
rem.userAgent = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://remlib.org/)';
rem.configFile = null;

/** 
 * URL functions
 */

// protocol://auth@hostname:port/pathname?query#hash

remutil.url = {

  parse: null,

  format: null,

  host: function (url) {
    return url.hostname && (url.hostname + (url.port ? ':' + url.port : ''));
  },

  path: function (url) {
    return url.pathname
      + (remutil.qs.stringify(url.query) ? '?' + remutil.qs.stringify(url.query) : '')
      + (url.hash ? '#' + encodeURIComponent(url.hash) : '');
  }

};

/**
 * Request functions
 */

remutil.request = {

  create: function (mod) {
    return remutil.request.url({
      method: 'GET',
      headers: {},
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
        'host': remutil.url.host(opts.url)
      })
    })
  },

  body: function (opts, type, body) {
    // Expand payload shorthand.
    if (typeof body == 'object') {
      if (type == 'form' || type == 'application/x-www-form-urlencoded') {
        type = 'application/x-www-form-urlencoded';
        body = remutil.qs.stringify(body);
      }
      if (type == 'json' || type == 'application/json') {
        type = 'application/json';
        body = remutil.safeJSONStringify(body);
      }
    }

    return remutil.modify(opts, {
      headers: remutil.modify(opts.headers, {
        'content-length': body.length,
        'content-type': type
      }),
      body: body
    });
  },

  send: null

};


/**
 * Local calling.
 */

/*
rem.url = function () {
  var segments = Array.prototype.slice.call(arguments);
  var query = typeof segments[segments.length - 1] == 'object' ? segments.pop() : {};
  var url = remutil.url.parse(segments.shift());
  url.pathname = remutil.path.join.apply(null, [url.pathname].concat(segments));
  url.query = remutil.modify(url.query, query);

  return new Route(remutil.request.create(url), 'form', function (req, next) {
    req.headers['user-agent'] = req.headers['user-agent'] || rem.userAgent;
    // TODO rem.globalAgent
    remutil.request.send(req, next);
    return req;
  });
};
*/

rem.serializer = {
  json: function (data) {
    return JSON.stringify(data).replace(/[\u007f-\uffff]/g, function (c) {
      return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
    });
  }
};

rem.parsers = {
  stream: function (res, next) {
    next(res);
  },

  binary: function (res, next) {
    remutil.consumeStream(res, next);
  },

  text: function (res, next) {
    remutil.consumeStream(res, function (data) {
      // Strip BOM signatures.
      next(String(data).replace(/^\uFEFF/, ''));
    });
  },

  json: function (res, next) {
    rem.parsers.text(req, res, function (data) {
      try {
        data = JSON.parse(String(data));
      } catch (e) {
        console.error('Could not parse JSON.', e)
      }
      next(data);
    });
  }

  xml: function (res, next) {
    rem.parsers.text(req, res, function (data) {
      try {
        remutil.parseXML(res, next);
      } catch (e) {
        console.error('Could not parse XML.', e)
      }
      next(data);
    });
  },
};


/**
 * An HTTP route.
 */

var Route = (function () {

  function Route (req, defaultBodyMime, callback) {
    this.req = req;
    this.defaultBodyMime = defaultBodyMime || 'json';
    this.callback = callback;
  }

  Route.prototype.get = function (query, next) {
    if (typeof query == 'function') {
      next = query;
      query = null;
    }
    return this.callback(remutil.modify(remutil.request.url(this.req, {
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
    return this.callback(remutil.modify(remutil.request.url(this.req, {
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
    return this.callback(remutil.modify(remutil.request.body(this.req, mime, body), {
      method: 'POST'
    }), next);
  };

  Route.prototype.put = function (mime, body, next) {
    if (typeof body == 'function') {
      next = body;
      body = mime;
      mime = this.defaultBodyMime;
    }
    return this.callback(remutil.modify(remutil.request.body(this.req, mime, body), {
      method: 'PUT'
    }), next);
  };

  Route.prototype.del = function (next) {
    return this.callback(remutil.modify(this.req, {
      method: 'DELETE'
    }), next);
  };

  return Route;

})();


/**
 * API
 */

var API = (function () {

  remutil.inherits(API, Middleware);

  function API (manifest, options) {
    this.manifest = manifest;
    this.options = options || {};

    // Defaults
    this.options.format = this.options.format || 'json';
  }

  // Configuration prompt.

  API.prototype.configure = function(cont) {
    return cont();
  };

  // Invoke as method.
  function invoke (api, segments, send) {
    var query = typeof segments[segments.length - 1] == 'object' ? segments.pop() : {};
    var pathname = remutil.path.join.apply(null, segments);

    return new Route(remutil.request.create({
      query: query, pathname: pathname
    }), api.manifest.uploadFormat, function (req, next) {
      api.middleware('request', req, function () {
        // Debug flag.
        if (api.debug) {
          console.error('[URL]', remutil.url.format(req.url));
        }

        send(req, next);

        return req;
      });
    });
  }

  // Formats

  for (var format in rem.parsers) {
    (function (format) {
      API.prototype[format] = function () {
        return invoke(this, Array.prototype.slice.call(arguments), function (req, next) {
          this.send(req, function (err, res) {
            this.middleware('response', req, res, function () {
              rem.parsers[format](req, res, next);
            });
          }.bind(this));
        }.bind(this));
      }
    })(format);
  }

  API.prototype.call = function () {
    return invoke(this, Array.prototype.slice.call(arguments), function (req, next) {
      this.send(req, function (err, res) {
        if (err) {
          next && next(err, null, res);
        } else {
          this.middleware('response', req, res, function () {
            this.parseStream(req, res, function (data) {
              next && next.call(this, res.statusCode >= 400 ? res.statusCode : 0, data, res);
            }.bind(this));
          }.bind(this));
        }
      }.bind(this));
    }.bind(this));
  };

  API.prototype.parseStream = function (req, res, next) {
    rem.parsers[this.options.format](res, next);
  };

  API.prototype.send = function (req, next) {
    remutil.request.send(req, this.agent, next);
  };

  // Root request shorthands.

  API.prototype.get = function (route) {
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

// Manifest API.

(function () {

  remutil.inherits(ManifestAPI, API);

  function ManifestAPI (manifest, options) {
    API.call(this, options);

    // Load format-specific options from the manifest.
    if (!this.manifest.formats) {
      this.manifest.formats = {json: {}};
    }
    if (!this.manifest.formats[this.format]) {
      throw new Error("Format \"" + this.format + "\" not available. Please specify an available format in the options parameter.");
    }
    this.manifest = remutil.modify(this.manifest, this.manifest.formats[this.format]);

    // Response. Expand payload shorthand.
    this.pre('request', function (req, next) {
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
    });

    // User agent.
    this.pre('request', function (req, next) {
      req.headers['user-agent'] = req.headers['user-agent'] || rem.userAgent;
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

  return ManifestAPI;

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

/**
 * Polling.
 */

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

/**
 * Server-side.
 */

if (typeof require != 'undefined') {
  // Authentication methods.
  require('./oauth');
  require('./aws');
  require('./session');

  // TODO more than Oauth.
  rem.console = rem.oauthConsole;
}
