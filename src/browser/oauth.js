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

function augment (c, b) {
  for (var k in b) {
    if (Object.prototype.hasOwnProperty.call(b, k) && b[k] != null) {
      c[k] = b[k];
    }
  }
  return c;
}

/**
 * OAuth handlers
 */

function createOAuthRequest (api, param1, param2) {
  param1.token = param1.token || api.options.oauthAccessToken;
  param1.tokenSecret = param1.tokenSecret || api.options.oauthAccessSecret;
  var accessor = {
    consumerSecret: api.options.secret
  };
  var message = {
    action: param1.url,
    method: 'GET',
    parameters: [
      ["oauth_consumer_key", api.options.key],
      ["oauth_signature_method", "HMAC-SHA1"]
    ]
  };

  if (param1.token != true) {
    message.parameters.push(["oauth_token", param1.token]);
  }
  if (param1.tokenSecret != true) {
    accessor.tokenSecret = param1.tokenSecret;
  }
  message.parameters.push.apply(message.parameters, param2);
  message.parameters.push(["callback", JSONP.getNextCallback()]);

  OAuth.setTimestampAndNonce(message);
  OAuth.SignatureMethod.sign(message, accessor);
  return message;
}

function sendOAuthRequest (api, param1, param2, next) {
  var message = createOAuthRequest(api, param1, param2);
  JSONP.get(message.action, OAuth.getParameterMap(message.parameters), false, next);
}

/**
 * OAuth 1
 */

// requestEndpoint
// accessEndpoint
// authorizeEndpoint

var OAuth1API = (function (_super) {

  rem.env.inherits(OAuth1API, rem.ManifestClient);

  function OAuth1API (manifest, options) {
    rem.ManifestClient.apply(this, arguments);

    this.config = this.manifest.auth;
    // TODO with options
  };

  OAuth1API.prototype.send = function (req, stream, next) {
    // Create params list from object.
    var list = [];
    for (var key in req.query) {
      list.push([key, req.query[key]]);
    }
    var url = String(req.url).replace(/\?.*$/, '');
    sendOAuthRequest(this, {
      url: url
    }, list, function (data) {
      var resstream = new rem.env.Stream();
      next(null, resstream);
      resstream.emit('data', JSON.stringify(data));
      resstream.emit('end');
    });
    return new rem.env.Stream();
  };

  return OAuth1API;

})();

var OAuth1Authentication = (function () {

  function OAuth1Authentication(api, redirect) {
    this.api = api;

    // Configuration.
    this.config = this.api.manifest.auth;
    // Get redirect URL.
    this.oob = !redirect;
    if (!(redirect || this.config.oob)) {
      throw new Error('Out-of-band OAuth for this API is not permitted.');
    }
    this.oauthRedirect = redirect || this.config.oobCallback || undefined;
  }

  OAuth1Authentication.prototype.start = function (next) {
    sendOAuthRequest(this.api, {
      url: this.config.requestEndpoint,
      token: true,
      tokenSecret: true
    }, [], function (data) {
      var dataArray = rem.env.qs.parse(data);
      var url = this.config.authorizeEndpoint + "?oauth_token=" + dataArray["oauth_token"] + "&oauth_callback=" + this.oauthRedirect;
      next(url, dataArray["oauth_token"], dataArray["oauth_token_secret"], dataArray)
    }.bind(this));
  };

  OAuth1Authentication.prototype.complete = function (requestToken, requestSecret, next) {
    sendOAuthRequest(this.api, {
      url: this.config.accessEndpoint,
      token: requestToken,
      tokenSecret: requestSecret
    }, [], function (data) {
      var dataArray = rem.env.qs.parse(data);
      store.set('rem:oauth:' + this.api.manifest.id + ':accessToken', dataArray["oauth_token"]);
      store.set('rem:oauth:' + this.api.manifest.id + ':accessSecret', dataArray["oauth_token_secret"]);

      this.loadState({
        oauthAccessToken: dataArray["oauth_token"],
        oauthAccessSecret: dataArray["oauth_token_secret"]
      }, function (user) {
        next(null, user);
      });
    }.bind(this));
  };

  OAuth1Authentication.prototype.loadState = function (data, next) {
    var options = clone(this.api.options);
    options.oauthAccessToken = data.oauthAccessToken;
    options.oauthAccessSecret = data.oauthAccessSecret;
    options.oauthRedirect = this.oauthRedirect;
    return next(callable(new OAuth1API(this.api.manifest, options)));
  };

  return OAuth1Authentication;

})();

rem.oauth = function (api, callback) {
  return new OAuth1Authentication(api, callback);
};

rem.promptOAuth = function () {
  var args = Array.prototype.slice.call(arguments);
  var next = args.pop(), api = args.shift(), params = args.pop() || null;

  var callbackUrl = window.location.href.replace(/[\?\#].*$/, '');
  var oauth = rem.oauth(api, callbackUrl);

  if (store.get('rem:oauth:' + api.manifest.id + ':accessToken') && store.get('rem:oauth:' + api.manifest.id + ':accessSecret')) {
    // Credentials were already stored.
    oauth.loadState({
      oauthAccessToken: store.get('rem:oauth:' + api.manifest.id + ':accessToken'),
      oauthAccessSecret: store.get('rem:oauth:' + api.manifest.id + ':accessSecret')
    }, function (user) {
      next(null, user);
    });
  } else if (window.location.search.indexOf('oauth_token') > -1 && store.get('rem:oauth:' + api.manifest.id + ':requestToken') && store.get('rem:oauth:' + api.manifest.id + ':requestSecret')) {
    // Credentials were already requested.
    oauth.complete(store.get('rem:oauth:' + api.manifest.id + ':requestToken'), store.get('rem:oauth:' + api.manifest.id + ':requestSecret'), next);
  } else {
    oauth.start(function (url, oauthRequestToken, oauthRequestSecret, results) {
      // Save credentials.
      store.set('rem:oauth:' + api.manifest.id + ':requestToken', oauthRequestToken);
      store.set('rem:oauth:' + api.manifest.id + ':requestSecret', oauthRequestSecret);
      // Navigate to new page.
      window.location.href = url;
    }.bind(this));
  }
};