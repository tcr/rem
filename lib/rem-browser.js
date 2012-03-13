(function() {
  var REM, manifests, querystring,
    __slice = Array.prototype.slice;

  document.write("<script type='text/javascript' src='../../lib/oauth.js'></script>");

  document.write("<script type='text/javascript' src='../../lib/sha1.js'></script>");

  document.write("<script type='text/javascript' src='../../lib/jsonp.js'></script>");

  document.write("<script type='text/javascript' src='../../lib/store.min.js'></script>");

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

  this.REM = REM = (function() {

    REM._counter = 0;

    function REM(name, version, opts) {
      var k, _i, _len, _ref;
      this.name = name;
      this.version = version != null ? version : '1';
      this.manifest = manifests[this.name][this.version];
      this.key = opts.key, this.secret = opts.secret;
      this.id = this.type + REM._counter++;
      _ref = ['requestToken', 'requestTokenSecret', 'accessToken', 'accessTokenSecret'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        k = _ref[_i];
        if (store.get("" + this.id + "-" + k) != null) {
          this[k] = store.get("" + this.id + "-" + k);
        }
      }
    }

    REM.prototype._createOAuthRequest = function(param1, param2) {
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

    REM.prototype._sendOAuthRequest = function() {
      var args, cb, message, _i;
      args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), cb = arguments[_i++];
      message = this._createOAuthRequest.apply(this, args);
      return JSONP.get(message.action, OAuth.getParameterMap(message.parameters), false, cb);
    };

    REM.prototype.startOAuthCallback = function(url) {
      var _this = this;
      if (url == null) url = window.location.href.replace(/\?.*$/, '');
      return this._sendOAuthRequest({
        url: "https://api.dropbox.com/1/oauth/request_token",
        type: "text",
        token: true,
        tokenSecret: true
      }, [], function(data) {
        var dataArray;
        dataArray = querystring.parse(data);
        store.set("" + _this.id + "-requestToken", dataArray["oauth_token"]);
        store.set("" + _this.id + "-requestTokenSecret", dataArray["oauth_token_secret"]);
        return document.location = "https://www.dropbox.com/1/oauth/authorize?oauth_token=" + dataArray["oauth_token"] + "&oauth_callback=" + url;
      });
    };

    REM.prototype.completeOAuth = function(cb) {
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
        url: "https://api.dropbox.com/1/oauth/access_token",
        type: "text",
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

    REM.prototype.get = function() {
      var cb, k, list, params, path, _arg, _i;
      path = arguments[0], _arg = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
      params = _arg[0];
      list = (function() {
        var _results;
        _results = [];
        for (k in params || {}) {
          _results.push([k, params[k]]);
        }
        return _results;
      })();
      return this._sendOAuthRequest({
        url: this._host + path
      }, list, function(data) {
        return cb(0, data);
      });
    };

    REM.prototype._host = "https://api.dropbox.com/1";

    REM.prototype.getUrl = function() {
      var cb, k, list, message, params, path, _arg, _i;
      path = arguments[0], _arg = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
      params = _arg[0];
      list = (function() {
        var _results;
        _results = [];
        for (k in params || {}) {
          _results.push([k, params[k]]);
        }
        return _results;
      })();
      message = this._createOAuthRequest({
        url: this._host + path
      }, list);
      return message.action + '?' + querystring.stringify(OAuth.getParameterMap(message.parameters));
    };

    REM.prototype.clearState = function() {
      return store.clear();
    };

    return REM;

  })();

}).call(this);
