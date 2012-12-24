/**


WORK IN PROGRESS
CURRENTLY BROKEN



*/


var util = require('util');
var fs = require('fs');
var path = require('path');

var async = require('async');
var read = require('read');
var express = require('express');
var nconf = require('nconf');
var osenv = require('osenv');

// Namespace.
var rem = require('../rem');
var remutil = require('../remutil');

/**
 * AWS signature.
 */


var AWSSignatureAPI = (function (_super) {

  var querystring = require('querystring');
  var crypto = require('crypto');

  util.inherits(AWSSignatureAPI, rem.API);

  function AWSSignatureAPI (manifest, opts) {
    AWSSignatureAPI.__super__.constructor.apply(this, arguments);
  }

  AWSSignatureAPI.prototype.processRequest = function (method, endpointUrl, mime, body, cb) {
    var endpoint, hash, k, v;
    endpoint = new Url(endpointUrl);

    // Add timestamp parameter.
    endpoint.query.Timestamp = new Date().toJSON();
    // Create a signature of query arguments.
    // TODO also POST arguments...
    hash = crypto.createHmac('sha256', this.opts.secret);
    hash.update([
      // Method
      "GET",
      // Value of host: header in lowercase
      endpoint.hostname.toLowerCase(),
      // HTTP Request URI
      endpoint.pathname,
      // Canonical query string (in byte order)
      ((function () {
        var _ref1, _results;
        _ref1 = endpoint.query;
        _results = [];
        for (k in _ref1) {
          v = _ref1[k];
          _results.push([k, v]);
        }
        return _results;
      })()).sort(function (_arg, _arg1) {
        var a, b;
        a = _arg[0];
        b = _arg1[0];
        return a > b;
      }).map(function (_arg) {
        var k, v;
        k = _arg[0], v = _arg[1];
        return querystring.escape(k) + '=' + querystring.escape(v);
      }).join('&')
    ].join('\n'));
    endpoint.query.Signature = hash.digest('base64');

    // HTTP Request.
    return sendHttpRequest(method, endpoint.toString(), mime, body, {
      data: cb
    });
  };

  return AWSSignatureAPI;

})();

exports.aws = function (api) {
  return remutil.callable(new AWSSignatureAPI(api.manifest, api.opts));
};