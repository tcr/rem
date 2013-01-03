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

env.EventEmitter = EventEmitter;

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

EventEmitter.prototype.once = function (type, f) {
  this.on(type, function g () { f.apply(this, arguments); this.removeListener(type, g) });
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

// Streams

env.Stream = Stream;

env.inherits(Stream, EventEmitter);

function Stream () { }

Stream.prototype.pipe = function (dest, options) {
  var source = this;

  function ondata (chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  function ondrain () {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  var didOnEnd = false;
  function onend () {
    if (didOnEnd) return;
    didOnEnd = true;
    dest.end();
  }

  function onclose () {
    if (didOnEnd) return;
    didOnEnd = true;
    if (typeof dest.destroy === 'function') dest.destroy();
  }

  function onerror (err) {
    cleanup();
    if (this.listeners('error').length === 0) {
      throw err; // Unhandled stream error in pipe.
    }
  }

  function cleanup() {
    source.removeListener('data', ondata); dest.removeListener('drain', ondrain);
    source.removeListener('end', onend); source.removeListener('close', onclose);
    source.removeListener('error', onerror); dest.removeListener('error', onerror);
    source.removeListener('end', cleanup); source.removeListener('close', cleanup);
    dest.removeListener('end', cleanup); dest.removeListener('close', cleanup);
  }

  source.on('data', ondata); dest.on('drain', ondrain);
  if ((!options || options.end !== false)) {
    source.on('end', onend); source.on('close', onclose);
  }
  source.on('error', onerror); dest.on('error', onerror);
  source.on('end', cleanup); source.on('close', cleanup);
  dest.on('end', cleanup); dest.on('close', cleanup);

  dest.emit('pipe', source);
  return dest;
};


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

env.parseURL = function (str) {
  var a = document.createElement('a');
  a.href = str.indexOf(':') == -1
    || (str.indexOf('?') > -1 && str.indexOf(':') > str.indexOf('?'))
    || (str.indexOf('#') > -1 && str.indexOf(':') > str.indexOf('#'))
    ? 'fake:' + str : str;
  return {
    protocol: a.protocol && a.protocol != 'fake:' ? a.protocol : null,
    auth: a.auth || null,
    hostname: a.hostname || null,
    port: a.port || null,
    pathname: a.pathname,
    query: env.qs.parse(a.search || ''),
    hash: a.hash ? decodeURIComponent(a.hash.substr(1)) : null
  };
};

env.formatURL = function (url) {
  var a = document.createElement('a');
  a.href = "http://example.com";
  a.protocol = url.protocol || 'http:';
  a.auth = url.auth;
  a.hostname = url.hostname;
  if (url.port) {
    a.port = url.port;
  }
  a.pathname = url.pathname;
  if (env.qs.stringify(url.query)) {
    a.search = env.qs.stringify(url.query);
  }
  if (url.hash) {
    a.hash = url.hash;
  }
  return a.href;
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

env.inherits(HTTPResponse, env.Stream);

/** @constructor */
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

// Some servers actually have an issue with this.
function camelCase (key) {
  return key.replace(/(?:^|\b)\w/g, function (match) {
    return match.toUpperCase();
  });
}

env.sendRequest = function (opts, agent, next) {
  // Format url.
  var url = String(opts.url);

  // Create XHR.
  var req = new XMLHttpRequest();
  req.onreadystatechange = function () {
    if (req.readyState == 2) {
      var res = new HTTPResponse(url, req);
      next(null, res);
    }
  }

  // Ignore "unsafe" headers so we don't pollute console logs.
  // See nsXMLHttpRequest.cpp for the origin of these.
  var UNSAFE_HEADERS = [
    "accept-charset", "accept-encoding", "access-control-request-headers",
    "access-control-request-method", "connection", "content-length",
    "cookie", "cookie2", "content-transfer-encoding", "date", "dnt",
    "expect", "host", "keep-alive", "origin", "referer", "te", "trailer",
    "transfer-encoding", "upgrade", "user-agent", "via"
  ];

  // Send request.
  req.open(opts.method, url, true);
  for (var k in opts.headers) {
    if (UNSAFE_HEADERS.indexOf(k) == -1) {
      req.setRequestHeader(camelCase(k), opts.headers[k]);
    }
  }

  // Return a writable stream interface to our XHR.
  var stream = new env.Stream, body = [];
  stream.writeable = true;
  stream.write = function (data) {
    body.push(data);
  };
  stream.end = function (data) {
    if (data) {
      body.push(data);
    }
    req.send(body.length ? body.join('') : null);
  };
  return stream;
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

var MANIFEST_PATH = 'http://www.remlib.org/m/'

env.lookupManifestSync = function (name, next) {
  throw new Error('Cannot synchronously load manifests in the browser. Use rem.loadAsync instead.');
};

env.lookupManifest = function (name, next) {
  var file = name.match(/^\.\/|\/\//)
    ? name
    : MANIFEST_PATH + env.joinPath('/', name).replace(/^\//, '');
  rem.json(file).get(next);
};

// Array/Buffer detection

env.isList = function (obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
};

env.concatList = function (obj) {
  return obj.join('');
};

// Next Tick.

env.nextTick = function (f) {
  setTimeout(f, 0);
};

// Prompt strings.

env.promptString = function (ask, next) {
  var val = prompt(ask);
  setTimeout(function () {
    next(val === null, val);
  });
};

// Prompt configuration.

env.promptConfiguration = function (rem, api, next) {
  var key, secret;
  if (!api.options.key && !store.get('rem:' + api.manifest.id + ':key')) {
    if (!(key = prompt("API key: "))) {
      return;
    }
    api.options.key = key;
    store.set('rem:' + api.manifest.id + ':key', key);
    if (!(secret = prompt("API secret: "))) {
      return;
    }
    api.options.secret = secret;
    store.set('rem:' + api.manifest.id + ':secret', secret);
  } else if (!api.options.key) {
    api.options.key = store.get('rem:' + api.manifest.id + ':key');
    api.options.secret = store.get('rem:' + api.manifest.id + ':secret');
  }

  next(api);
};

env.promptAuthentication = function (rem, api, opts, next) {
  rem.promptOAuth(api, opts, next);
};

// Creation handler. Check transparent JSONP or CORS support.

env.oncreate = function (api) {
  // !CORS && !JSONP
  if (!api.manifest.cors && !api.manifest.jsonp) {
    console.error('Warning: API does not specify explicit support for JSONP or CORS. Only same-origin requests allowed.');
  }

  // JSONP
  if (!api.manifest.cors && api.manifest.jsonp) {
    api.use(function (req, next) {
      if (req.method != 'GET') {
        throw new Error('Only GET calls can be made from a JSONP API.');
      }
      // TODO this will fail.
      req.url.query[api.manifest.jsonp] = JSONP.getNextCallback();
      next();
    });
    api.send = function (req, stream, next) {
      var url = String(req.url);
      JSONP.get(url, null, false, function (json) {
        // Now fake a whole request.
        var res = new env.Stream();
        res.url = url;
        res.statusText = '';
        res.statusCode = 200; // Not like we'd have any idea.
        next(null, res);
        res.emit('data', JSON.stringify(json));
        res.emit('end');
      });
      return new env.Stream();
    };
  }
};