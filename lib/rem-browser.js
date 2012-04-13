(function() {
  var API, Route, manifests, querystring, rem,
    __slice = Array.prototype.slice;

  document.write("<script type='text/javascript' src='../lib/oauth.js'></script>");

  document.write("<script type='text/javascript' src='../lib/sha1.js'></script>");

  document.write("<script type='text/javascript' src='../lib/jsonp.js'></script>");

  document.write("<script type='text/javascript' src='../lib/store.min.js'></script>");

  manifests = {
    "dropbox": {
      "1": {
        "name": "Dropbox",
        "docs": "https://www.dropbox.com/developers",
        "base": [["^/(files(_put)?|thumbnails)/.*", "https://api-content.dropbox.com/1"], "https://api.dropbox.com/1"],
        "auth": {
          "oauth": {
            "version": "1.0",
            "requestEndpoint": "https://api.dropbox.com/1/oauth/request_token",
            "accessEndpoint": "https://api.dropbox.com/1/oauth/access_token",
            "authorizeEndpoint": "https://www.dropbox.com/1/oauth/authorize",
            "validate": "/account/info",
            "oob": true,
            "oobVerifier": false
          }
        }
      }
    },
    "twitter": {
      "1": {
        "name": "Twitter",
        "docs": "https://dev.twitter.com/docs",
        "base": [["^/search", "https://search.twitter.com"], "https://api.twitter.com/1"],
        "postType": "form",
        "suffix": ".json",
        "auth": {
          "oauth": {
            "version": "1.0",
            "requestEndpoint": "https://api.twitter.com/oauth/request_token",
            "accessEndpoint": "https://api.twitter.com/oauth/access_token",
            "authorizeEndpoint": "https://api.twitter.com/oauth/authorize",
            "emptyCallback": "oob",
            "validate": "/account/verify_credentials",
            "oob": true
          }
        }
      }
    }
  };

  querystring = {
    parse: function(str) {
      var k, obj, pair, v, _i, _len, _ref, _ref2;
      obj = {};
      _ref = str.split("&");
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        pair = _ref[_i];
        _ref2 = pair.split("="), k = _ref2[0], v = _ref2[1];
        obj[k] = v;
      }
      return obj;
    },
    stringify: function(obj) {
      var k, str, v;
      str = "";
      for (k in obj) {
        v = obj[k];
        str += k + '=' + v + '&';
      }
      return str;
    }
  };

  Route = (function() {

    function Route(api, path, query) {
      this.api = api;
      this.path = path != null ? path : '';
      this.query = query != null ? query : {};
    }

    Route.prototype.get = function(cb) {
      return this.api.request('get', this.path, this.query, null, null, cb);
    };

    return Route;

  })();

  API = (function() {
    var getHost;

    API._counter = 0;

    getHost = function(hosturl) {
      var _ref;
      try {
        return (_ref = hosturl.match(/^https?:\/\/[^\/]+/)) != null ? _ref[0] : void 0;
      } catch (e) {
        return null;
      }
    };

    function API(manifest, opts) {
      var k, v, _i, _len, _ref, _ref2, _ref3,
        _this = this;
      this.manifest = manifest;
      this.opts = opts != null ? opts : {};
      _ref = this.opts, this.key = _ref.key, this.secret = _ref.secret;
      this.format = (_ref2 = this.opts.format) != null ? _ref2 : 'json';
      _ref3 = ['requestToken', 'requestTokenSecret', 'accessToken', 'accessTokenSecret'];
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        k = _ref3[_i];
        if (store.get("" + this.id + "-" + k) != null) {
          this[k] = store.get("" + this.id + "-" + k);
        }
      }
      this.filters = [];
      if (this.manifest.basepath != null) {
        this.filters.push(function(endpoint) {
          return endpoint.pathname = _this.manifest.basepath + endpoint.pathname;
        });
      }
      if (this.manifest.suffix != null) {
        this.filters.push(function(endpoint) {
          return endpoint.pathname += _this.manifest.suffix;
        });
      }
      if (this.manifest.keyAsParam != null) {
        this.filters.push(function(endpoint) {
          return endpoint.query[_this.manifest.keyAsParam] = _this.key;
        });
      }
      if (this.manifest.params != null) {
        this.filters.push(function(endpoint) {
          var qk, qv, _ref4, _results;
          _ref4 = _this.manifest.params;
          _results = [];
          for (qk in _ref4) {
            qv = _ref4[qk];
            _results.push(endpoint.query[qk] = qv);
          }
          return _results;
        });
      }
      if (typeof this.manifest.base === 'object') {
        this.hosts = (function() {
          var _j, _len2, _ref4, _results;
          _ref4 = this.manifest.base;
          _results = [];
          for (_j = 0, _len2 = _ref4.length; _j < _len2; _j++) {
            v = _ref4[_j];
            _results.push(getHost(typeof v === 'object' ? v[1] : v));
          }
          return _results;
        }).call(this);
      } else {
        this.hosts = [getHost(this.manifest.base)];
      }
    }

    API.prototype._createOAuthRequest = function(param1, param2) {
      var accessor, i, message;
      if (param1.token == null) param1.token = this.accessToken;
      if (param1.tokenSecret == null) param1.tokenSecret = this.accessTokenSecret;
      accessor = {
        consumerSecret: this.secret
      };
      message = {
        action: param1.url,
        method: 'GET',
        parameters: [["oauth_consumer_key", this.key], ["oauth_signature_method", "HMAC-SHA1"]]
      };
      if (param1.token !== true) {
        message.parameters.push(["oauth_token", param1.token]);
      }
      if (param1.tokenSecret !== true) accessor.tokenSecret = param1.tokenSecret;
      for (i in param2) {
        message.parameters.push(param2[i]);
      }
      message.parameters.push(["callback", JSONP.getNextCallback()]);
      OAuth.setTimestampAndNonce(message);
      OAuth.SignatureMethod.sign(message, accessor);
      return message;
    };

    API.prototype._sendOAuthRequest = function() {
      var args, cb, message, _i;
      args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), cb = arguments[_i++];
      message = this._createOAuthRequest.apply(this, args);
      return JSONP.get(message.action, OAuth.getParameterMap(message.parameters), false, cb);
    };

    API.prototype.startOAuthCallback = function(url) {
      var _this = this;
      if (url == null) url = window.location.href.replace(/\?.*$/, '');
      return this._sendOAuthRequest({
        url: this.manifest.auth.oauth.requestEndpoint,
        token: true,
        tokenSecret: true
      }, [], function(data) {
        var dataArray;
        dataArray = querystring.parse(data);
        store.set("" + _this.id + "-requestToken", dataArray["oauth_token"]);
        store.set("" + _this.id + "-requestTokenSecret", dataArray["oauth_token_secret"]);
        return document.location = _this.manifest.auth.oauth.authorizeEndpoint + "?oauth_token=" + dataArray["oauth_token"] + "&oauth_callback=" + url;
      });
    };

    API.prototype.completeOAuth = function(cb) {
      var _this = this;
      if (this.accessToken && this.accessTokenSecret) {
        cb(0);
        return;
      }
      if (!(this.requestToken && this.requestTokenSecret)) {
        cb({
          error: "OAuth token not yet requested."
        });
        return;
      }
      return this._sendOAuthRequest({
        url: this.manifest.auth.oauth.accessEndpoint,
        token: this.requestToken,
        tokenSecret: this.requestTokenSecret
      }, [], function(data) {
        var dataArray;
        dataArray = querystring.parse(data);
        store.set("" + _this.id + "-accessToken", dataArray["oauth_token"]);
        store.set("" + _this.id + "-accessTokenSecret", dataArray["oauth_token_secret"]);
        _this.accessToken = dataArray["oauth_token"];
        _this.accessTokenSecret = dataArray["oauth_token_secret"];
        return cb();
      });
    };

    API.prototype.call = function(path, query) {
      return new Route(this, path, query);
    };

    API.prototype.request = function(method, path, query, mime, body, cb) {
      var base, endpointUrl, k, list, pat, _i, _len, _ref;
      if (path[0] !== '/') path = '/' + path;
      if (typeof this.manifest.base === 'string') {
        base = this.manifest.base;
      } else {
        base = '';
        _ref = this.manifest.base;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          pat = _ref[_i];
          if (typeof pat === 'string') {
            base = pat;
            break;
          }
          if (path.match(new RegExp(pat[0]))) {
            base = pat[1];
            break;
          }
        }
      }
      /*
      		endpoint = url.parse base + path
      		endpoint.query = {}
      		for qk, qv of query
      			endpoint.query[qk] = qv
      		for filter in @filters
      			filter endpoint
      		# Normalize endpoint.
      		endpointUrl = url.format endpoint
      		endpoint = url.parse endpointUrl
      */
      endpointUrl = base + path;
      list = (function() {
        var _results;
        _results = [];
        for (k in query || {}) {
          _results.push([k, query[k]]);
        }
        return _results;
      })();
      return $.ajax({
        url: endpointUrl + '?' + querystring.stringify(query),
        data: body,
        dataType: mime,
        success: function(data) {
          return cb(0, data);
        },
        error: function(err) {
          return cb(err, null);
        }
      });
    };

    API.prototype.clearState = function() {
      return store.clear();
    };

    return API;

  })();

  this.rem = rem = {};

  rem.create = function(manifest, opts) {
    var f, k, v, _ref;
    f = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return f.call.apply(f, args);
    };
    _ref = API.prototype;
    for (k in _ref) {
      v = _ref[k];
      f[k] = v;
    }
    API.call(f, manifest, opts);
    return f;
  };

  rem.load = function(name, version, opts) {
    var manifest;
    if (opts == null) opts = {};
    manifest = manifests[name][version];
    if (!manifest) {
      throw new Error('Unable to construct API ' + name + '::' + version);
    }
    return rem.create(manifest, opts);
  };

}).call(this);
