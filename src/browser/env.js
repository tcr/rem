var env = {};

// inherits

env.inherits = function (ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false
    }
  });
};

// EventEmitter

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

env.EventEmitter = EventEmitter;


// Stream.

env.consumeStream = function (stream, next) {
  var buf = [];
  stream.on('data', function (data) {
    buf.push(data);
  });
  stream.on('end', function () {
    next(buf.join(''));
  });
};

// URL

env.url = {
  parse: function (str) {
    var a = document.createElement('a');
    a.href = str;
    return {
      protocol: a.protocol,
      auth: a.auth,
      hostname: a.hostname,
      port: a.port,
      pathname: a.pathname,
      query: env.qs.parse(a.search || ''),
      hash: a.hash && decodeURIComponent(a.hash.substr(1))
    };
  },

  format: function (url) {
    var a = document.createElement('a');
    a.protocol = url.protocol;
    a.auth = url.auth;
    a.hostname = url.hostname;
    a.port = url.port;
    a.pathname = url.pathname;
    a.query = env.qs.stringify(url.query);
    a.hash = url.hash;
    return a.href;
  }
};

// Query string

env.qs = {
  parse: function (query) {
    var ret = {};
    var seg = query.replace(/^\?/, '').replace(/\+/g, ' ').split('&');
    for (var i = 0, len = seg.length, s; i < len; i++) {
      if (seg[i]) {
        s = seg[i].split('=');
        ret[decodeURIComponent(s[0])] = decodeURIComponent(s[1]);
      }
    }
    return ret;
  },

  stringify: function (query) {
    var str = [];
    for (var k in query) {
      str.push(encodeURIComponent(k) + (query[k] == null ? '' : '=' + encodeURIComponent(query[k])));
    }
    return str.join('&');
  }
};

// Request

env.inherits(HTTPResponse, env.EventEmitter);

function HTTPResponse (url, xhr) {
  var len = 0;
  this.url = url;
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

env.sendRequest = function (opts, next) {
  // Format url.
  var url = env.url.format(opts.url);

  // Create XHR.
  var req = new XMLHttpRequest();
  req.onreadystatechange = function () {
    if (req.readyState == 2) {
      var res = new HTTPResponse(url, req);
      next(((req.statusCode / 100) | 0) != 2 && req.statusCode, res);
    }
  }

  // Send request.
  // Ignore "unsafe" headers so we don't pollute console logs.
  var UNSAFE_HEADERS = ['host', 'user-agent', 'content-length'];
  req.open(opts.method, url, true);
  var headers = camelCaseHeaders(opts.headers);
  for (var k in headers) {
    if (UNSAFE_HEADERS.indexOf(k) == -1) {
      req.setRequestHeader(k, headers[k]);
    }
  }
  req.send(opts.body);
};

// Path

env.joinPath = function () {
  var args = Array.prototype.slice.call(arguments);
  var a = document.createElement('a');
  a.href = window.location.href;
  a.pathname = args.join('/').replace(/\/+/g, '/');
  return a.pathname.substr(args[0] && args[0][0] == '/' ? 0 : 1);
};

// XML parsing

if (typeof window.DOMParser != "undefined") {
  env.parseXML = function (data, next) {
    next((new window.DOMParser()).parseFromString(data, "text/xml"));
  };
} else if (typeof window.ActiveXObject != "undefined" && new window.ActiveXObject("Microsoft.XMLDOM")) {
  env.parseXML = function (data, next) {
    var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
    xmlDoc.async = "false";
    xmlDoc.loadXML(data);
    next(xmlDoc);
  };
} else {
  throw new Error("No XML parser found");
}

// Lookup

env.lookupManifestSync = null;

env.lookupManifest = function (name, next) {
  // TODO
};

// Array/Buffer detection

env.isList = function (obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
};