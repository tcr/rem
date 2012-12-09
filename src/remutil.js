// Namespace.
var remutil = typeof require == 'undefined' ? this.remutil = {} : exports;

/**
 * Utilities
 */

remutil.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

remutil.modify = function (a, b) {
  //var c = remutil.clone(a);
  var c = {};
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

remutil.safeJSONStringify = function (s) {
  return JSON.stringify(s).replace(/[\u007f-\uffff]/g, function (c) {
    return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
  });
};

remutil.inherits = function (ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false
    }
  });
};

remutil.consumeStream = null;

/**
 * EventEmitter
 */

function EventEmitter () { }

EventEmitter.prototype.listeners = function (type) {
  return this.hasOwnProperty.call(this._events || (this._events = {}), type) ? this._events[type] : this._events[type] = [];
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener = function (type, f) {
  if (this._maxListeners !== 0 && this.listeners(type).push(f) > (this._maxListeners || 10)) {
    console && console.warn('Possible EventEmitter memory leak detected. ' + this._events[type].length + ' listeners added. Use emitter.setMaxListeners() to increase limit.');
  }
  this.emit("newListener", type, f);
  return this;
};

EventEmitter.prototype.removeListener = function (type, f) {
  var i;
  (i = this.listeners(type).indexOf(f)) != -1 && this.listeners(type).splice(i, 1);
  return this;
};

EventEmitter.prototype.removeAllListeners = function (type) {
  for (var k in this._events) {
    (!type || type == k) && this._events[k].splice(0, this._events[k].length);
  }
  return this;
};

EventEmitter.prototype.emit = function (type) {
  var args = Array.prototype.slice.call(arguments, 1);
  for (var i = 0, fns = this.listeners(type).slice(); i < fns.length; i++) {
    fns[i].apply(this, args);
  }
  return fns.length;
};

EventEmitter.prototype.setMaxListeners = function (maxListeners) {
  this._maxListeners = maxListeners;
};

remutil.EventEmitter = EventEmitter;

/** 
 * URL primitive
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
 * Request primitive
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
 * Query string parsing.
 */

remutil.qs = {

  stringify: null,

  parse: null

};

/**
 * Path
 */

remutil.path = {

  join: null

};

/** 
 * Manifest lookup.
 */

remutil.lookup = function (name) {
  var fs = require('fs');
  var path = require('path');
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../services', name + '.json')));
  } catch (e) {
    return null;
  }
};

/**
 * Node.js
 */

(typeof require != 'undefined') && (function () {

  // Stream.

  remutil.consumeStream = function (stream, next) {
    var buf = [];
    stream.on('data', function (data) {
      buf.push(data);
    });
    stream.on('end', function () {
      next(Buffer.concat(buf));
    });
  };

  // URL

  var url = require('url');

  remutil.url.parse = function (str) {
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
  };

  remutil.url.format = function (str) {
    return url.format(str);
  };

  // Request

  var http = require('http');
  var https = require('https');
  var querystring = require('querystring');

  // Some servers actually have an issue with this.
  function camelCaseHeaders (lower) {
    var camel = {};
    for (var key in lower) {
      camel[key.replace(/(?:^|\b)\w/g, function (match) {
        return match.toUpperCase();
      })] = lower[key];
    }
    return camel;
  }

  remutil.request.send = function (opts, agent, next) {
    // Accept HTTP agent. Node.js only.
    if (next == null) {
      next = agent;
      agent = null;
    }

    var req = (opts.url.protocol == 'https:' ? https : http).request({
      agent: agent || undefined,
      method: opts.method,
      headers: camelCaseHeaders(opts.headers),
      protocol: opts.url.protocol,
      hostname: opts.url.hostname,
      port: opts.url.port,
      path: remutil.url.path(opts.url)
    });

    // Response.
    req.on('response', function (res) {
      // Attempt to follow Location: headers.
      if (((res.statusCode / 100) | 0) == 3 && res.headers['location'] && opts.redirect !== false) {
        remutil.request.send(remutil.request.url(opts, res.headers['location']), agent, next);
      } else {
        res.url = remutil.url.format(opts.url); // Populate res.url property
        next && next(null, res);
      }
    });

    // Headers.
    if (opts.body != null) {
      req.write(opts.body);
    }
    req.end();

    return req;
  };

  // Query

  remutil.qs = require('querystring');

  // Path

  remutil.path = require('path');

})();

/**
 * Browser.
 */

(typeof require == 'undefined') && (function () {

  // Stream.

  remutil.consumeStream = function (stream, next) {
    var buf = [];
    stream.on('data', function (data) {
      buf.push(data);
    });
    stream.on('end', function () {
      next(buf.join(''));
    });
  };

  // URL

  remutil.url.parse = function (str) {
    var a = document.createElement('a');
    a.href = str;
    return {
      protocol: a.protocol,
      auth: a.auth,
      hostname: a.hostname,
      port: a.port,
      pathname: a.pathname,
      query: remutil.qs.parse(a.search || ''),
      hash: a.hash && decodeURIComponent(a.hash.substr(1))
    };
  };

  remutil.url.format = function (url) {
    var a = document.createElement('a');
    a.protocol = url.protocol;
    a.auth = url.auth;
    a.hostname = url.hostname;
    a.port = url.port;
    a.pathname = url.pathname;
    a.query = remutil.qs.stringify(url.query);
    a.hash = url.hash;
    return a.href;
  };

  // Query string

  remutil.qs.parse = function (query) {
    var ret = {};
    var seg = query.replace(/^\?/, '').replace(/\+/g, ' ').split('&');
    for (var i = 0, len = seg.length, s; i < len; i++) {
      if (seg[i]) {
        s = seg[i].split('=');
        ret[decodeURIComponent(s[0])] = decodeURIComponent(s[1]);
      }
    }
    return ret;
  };

  remutil.qs.stringify = function (query) {
    var str = [];
    for (var k in query) {
      str.push(encodeURIComponent(k) + (query[k] == null ? '' : '=' + encodeURIComponent(query[k])));
    }
    return str.join('&');
  };

  // Request

  remutil.inherits(HTTPResponse, EventEmitter);

  function HTTPResponse (xhr) {
    var len = 0;
    this.statusText = xhr.statusText;
    this.statusCode = xhr.status;
    xhr.onreadystatechange = function () {
      if (xhr.readyState == 3) {
        this.emit('data', xhr.responseText.substr(len));
        len = xhr.responseText.length;
      }
      if (xhr.readyState == 4) {
        if (len < xhr.responseText.length) {
          this.emit('data', xhr.responseText.substr(len));
        }
        this.emit('end')
      }
    }.bind(this);
  }

  remutil.request.send = function (opts, next) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function () {
      if (req.readyState == 2) {
        var res = new HTTPResponse(req);
        next(((req.statusCode / 100) | 0) != 2 && req.statusCode, res);
      }
    }

    // Send request.
    // Ignore "unsafe" headers so we don't pollute console logs.
    var UNSAFE_HEADERS = ['host', 'user-agent', 'content-length'];
    req.open(opts.method, remutil.url.format(opts.url), true);
    var headers = camelCaseHeaders(opts.headers);
    for (var k in headers) {
      if (UNSAFE_HEADERS.indexOf(k) == -1) {
        req.setRequestHeader(k, headers[k]);
      }
    }
    req.send(opts.body);
  };

  // Path

  remutil.path.join = function () {
    var args = Array.prototype.slice.call(arguments);
    var a = document.createElement('a');
    a.href = window.location.href;
    a.pathname = args.join('/').replace(/\/+/g, '/');
    return a.pathname.substr(args[0] && args[0][0] == '/' ? 0 : 1);
  };

})();
