//Lightweight JSONP fetcher - www.nonobtrusive.com
var JSONP = (function(){
	var counter = 0, head, query, key, window = this;
	function load(url) {
		var script = document.createElement('script'),
			done = false;
		script.src = url;
		script.async = true;
 
		script.onload = script.onreadystatechange = function() {
			if ( !done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") ) {
				done = true;
				script.onload = script.onreadystatechange = null;
				if ( script && script.parentNode ) {
					script.parentNode.removeChild( script );
				}
			}
		};
		if ( !head ) {
			head = document.getElementsByTagName('head')[0];
		}
		head.appendChild( script );
	}
	function jsonp(url, params, addCallback, callback) {
		if (!callback) {
			callback = addCallback
			addCallback = true
		}
		var query = '';
		if (params) {
			query = "?";
			params = params || {};
			for ( key in params ) {
				if ( params.hasOwnProperty(key) ) {
					query += encodeURIComponent(key) + "=" + encodeURIComponent(params[key]) + "&";
				}
			}
		}
		var jsonp = "json" + (++counter);
		window[ jsonp ] = function(data){
			callback(data);
			try {
				delete window[ jsonp ];
			} catch (e) {}
			window[ jsonp ] = null;
		};
 
		load(url + query + (addCallback ? "callback=" + jsonp : ""))
		return jsonp;
	}
	return {
		get:jsonp,
		getNextCallback: function () {return 'json' + (counter + 1)}
	};
}());/*
 * Copyright 2008 Netflix, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* Here's some JavaScript software for implementing OAuth.

   This isn't as useful as you might hope.  OAuth is based around
   allowing tools and websites to talk to each other.  However,
   JavaScript running in web browsers is hampered by security
   restrictions that prevent code running on one website from
   accessing data stored or served on another.

   Before you start hacking, make sure you understand the limitations
   posed by cross-domain XMLHttpRequest.

   On the bright side, some platforms use JavaScript as their
   language, but enable the programmer to access other web sites.
   Examples include Google Gadgets, and Microsoft Vista Sidebar.
   For those platforms, this library should come in handy.
*/

// The HMAC-SHA1 signature method calls b64_hmac_sha1, defined by
// http://pajhome.org.uk/crypt/md5/sha1.js

/* An OAuth message is represented as an object like this:
   {method: "GET", action: "http://server.com/path", parameters: ...}

   The parameters may be either a map {name: value, name2: value2}
   or an Array of name-value pairs [[name, value], [name2, value2]].
   The latter representation is more powerful: it supports parameters
   in a specific sequence, or several parameters with the same name;
   for example [["a", 1], ["b", 2], ["a", 3]].

   Parameter names and values are NOT percent-encoded in an object.
   They must be encoded before transmission and decoded after reception.
   For example, this message object:
   {method: "GET", action: "http://server/path", parameters: {p: "x y"}}
   ... can be transmitted as an HTTP request that begins:
   GET /path?p=x%20y HTTP/1.0
   (This isn't a valid OAuth request, since it lacks a signature etc.)
   Note that the object "x y" is transmitted as x%20y.  To encode
   parameters, you can call OAuth.addToURL, OAuth.formEncode or
   OAuth.getAuthorization.

   This message object model harmonizes with the browser object model for
   input elements of an form, whose value property isn't percent encoded.
   The browser encodes each value before transmitting it. For example,
   see consumer.setInputs in example/consumer.js.
 */

/* This script needs to know what time it is. By default, it uses the local
   clock (new Date), which is apt to be inaccurate in browsers. To do
   better, you can load this script from a URL whose query string contains
   an oauth_timestamp parameter, whose value is a current Unix timestamp.
   For example, when generating the enclosing document using PHP:

   <script src="oauth.js?oauth_timestamp=<?=time()?>" ...

   Another option is to call OAuth.correctTimestamp with a Unix timestamp.
 */

var OAuth; if (OAuth == null) OAuth = {};

OAuth.setProperties = function setProperties(into, from) {
    if (into != null && from != null) {
        for (var key in from) {
            into[key] = from[key];
        }
    }
    return into;
}

OAuth.setProperties(OAuth, // utility functions
{
    percentEncode: function percentEncode(s) {
        if (s == null) {
            return "";
        }
        if (s instanceof Array) {
            var e = "";
            for (var i = 0; i < s.length; ++s) {
                if (e != "") e += '&';
                e += OAuth.percentEncode(s[i]);
            }
            return e;
        }
        s = encodeURIComponent(s);
        // Now replace the values which encodeURIComponent doesn't do
        // encodeURIComponent ignores: - _ . ! ~ * ' ( )
        // OAuth dictates the only ones you can ignore are: - _ . ~
        // Source: http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Functions:encodeURIComponent
        s = s.replace(/\!/g, "%21");
        s = s.replace(/\*/g, "%2A");
        s = s.replace(/\'/g, "%27");
        s = s.replace(/\(/g, "%28");
        s = s.replace(/\)/g, "%29");
        return s;
    }
,
    decodePercent: function decodePercent(s) {
        if (s != null) {
            // Handle application/x-www-form-urlencoded, which is defined by
            // http://www.w3.org/TR/html4/interact/forms.html#h-17.13.4.1
            s = s.replace(/\+/g, " ");
        }
        return decodeURIComponent(s);
    }
,
    /** Convert the given parameters to an Array of name-value pairs. */
    getParameterList: function getParameterList(parameters) {
        if (parameters == null) {
            return [];
        }
        if (typeof parameters != "object") {
            return OAuth.decodeForm(parameters + "");
        }
        if (parameters instanceof Array) {
            return parameters;
        }
        var list = [];
        for (var p in parameters) {
            list.push([p, parameters[p]]);
        }
        return list;
    }
,
    /** Convert the given parameters to a map from name to value. */
    getParameterMap: function getParameterMap(parameters) {
        if (parameters == null) {
            return {};
        }
        if (typeof parameters != "object") {
            return OAuth.getParameterMap(OAuth.decodeForm(parameters + ""));
        }
        if (parameters instanceof Array) {
            var map = {};
            for (var p = 0; p < parameters.length; ++p) {
                var key = parameters[p][0];
                if (map[key] === undefined) { // first value wins
                    map[key] = parameters[p][1];
                }
            }
            return map;
        }
        return parameters;
    }
,
    getParameter: function getParameter(parameters, name) {
        if (parameters instanceof Array) {
            for (var p = 0; p < parameters.length; ++p) {
                if (parameters[p][0] == name) {
                    return parameters[p][1]; // first value wins
                }
            }
        } else {
            return OAuth.getParameterMap(parameters)[name];
        }
        return null;
    }
,
    formEncode: function formEncode(parameters) {
        var form = "";
        var list = OAuth.getParameterList(parameters);
        for (var p = 0; p < list.length; ++p) {
            var value = list[p][1];
            if (value == null) value = "";
            if (form != "") form += '&';
            form += OAuth.percentEncode(list[p][0])
              +'='+ OAuth.percentEncode(value);
        }
        return form;
    }
,
    decodeForm: function decodeForm(form) {
        var list = [];
        var nvps = form.split('&');
        for (var n = 0; n < nvps.length; ++n) {
            var nvp = nvps[n];
            if (nvp == "") {
                continue;
            }
            var equals = nvp.indexOf('=');
            var name;
            var value;
            if (equals < 0) {
                name = OAuth.decodePercent(nvp);
                value = null;
            } else {
                name = OAuth.decodePercent(nvp.substring(0, equals));
                value = OAuth.decodePercent(nvp.substring(equals + 1));
            }
            list.push([name, value]);
        }
        return list;
    }
,
    setParameter: function setParameter(message, name, value) {
        var parameters = message.parameters;
        if (parameters instanceof Array) {
            for (var p = 0; p < parameters.length; ++p) {
                if (parameters[p][0] == name) {
                    if (value === undefined) {
                        parameters.splice(p, 1);
                    } else {
                        parameters[p][1] = value;
                        value = undefined;
                    }
                }
            }
            if (value !== undefined) {
                parameters.push([name, value]);
            }
        } else {
            parameters = OAuth.getParameterMap(parameters);
            parameters[name] = value;
            message.parameters = parameters;
        }
    }
,
    setParameters: function setParameters(message, parameters) {
        var list = OAuth.getParameterList(parameters);
        for (var i = 0; i < list.length; ++i) {
            OAuth.setParameter(message, list[i][0], list[i][1]);
        }
    }
,
    /** Fill in parameters to help construct a request message.
        This function doesn't fill in every parameter.
        The accessor object should be like:
        {consumerKey:'foo', consumerSecret:'bar', accessorSecret:'nurn', token:'krelm', tokenSecret:'blah'}
        The accessorSecret property is optional.
     */
    completeRequest: function completeRequest(message, accessor) {
        if (message.method == null) {
            message.method = "GET";
        }
        var map = OAuth.getParameterMap(message.parameters);
        if (map.oauth_consumer_key == null) {
            OAuth.setParameter(message, "oauth_consumer_key", accessor.consumerKey || "");
        }
        if (map.oauth_token == null && accessor.token != null) {
            OAuth.setParameter(message, "oauth_token", accessor.token);
        }
        if (map.oauth_version == null) {
            OAuth.setParameter(message, "oauth_version", "1.0");
        }
        if (map.oauth_timestamp == null) {
            OAuth.setParameter(message, "oauth_timestamp", OAuth.timestamp());
        }
        if (map.oauth_nonce == null) {
            OAuth.setParameter(message, "oauth_nonce", OAuth.nonce(6));
        }
        OAuth.SignatureMethod.sign(message, accessor);
    }
,
    setTimestampAndNonce: function setTimestampAndNonce(message) {
        OAuth.setParameter(message, "oauth_timestamp", OAuth.timestamp());
        OAuth.setParameter(message, "oauth_nonce", OAuth.nonce(6));
    }
,
    addToURL: function addToURL(url, parameters) {
        newURL = url;
        if (parameters != null) {
            var toAdd = OAuth.formEncode(parameters);
            if (toAdd.length > 0) {
                var q = url.indexOf('?');
                if (q < 0) newURL += '?';
                else       newURL += '&';
                newURL += toAdd;
            }
        }
        return newURL;
    }
,
    /** Construct the value of the Authorization header for an HTTP request. */
    getAuthorizationHeader: function getAuthorizationHeader(realm, parameters) {
        var header = 'OAuth realm="' + OAuth.percentEncode(realm) + '"';
        var list = OAuth.getParameterList(parameters);
        for (var p = 0; p < list.length; ++p) {
            var parameter = list[p];
            var name = parameter[0];
            if (name.indexOf("oauth_") == 0) {
                header += ',' + OAuth.percentEncode(name) + '="' + OAuth.percentEncode(parameter[1]) + '"';
            }
        }
        return header;
    }
,
    /** Correct the time using a parameter from the URL from which the last script was loaded. */
    correctTimestampFromSrc: function correctTimestampFromSrc(parameterName) {
        parameterName = parameterName || "oauth_timestamp";
        var scripts = document.getElementsByTagName('script');
        if (scripts == null || !scripts.length) return;
        var src = scripts[scripts.length-1].src;
        if (!src) return;
        var q = src.indexOf("?");
        if (q < 0) return;
        parameters = OAuth.getParameterMap(OAuth.decodeForm(src.substring(q+1)));
        var t = parameters[parameterName];
        if (t == null) return;
        OAuth.correctTimestamp(t);
    }
,
    /** Generate timestamps starting with the given value. */
    correctTimestamp: function correctTimestamp(timestamp) {
        OAuth.timeCorrectionMsec = (timestamp * 1000) - (new Date()).getTime();
    }
,
    /** The difference between the correct time and my clock. */
    timeCorrectionMsec: 0
,
    timestamp: function timestamp() {
        var t = (new Date()).getTime() + OAuth.timeCorrectionMsec;
        return Math.floor(t / 1000);
    }
,
    nonce: function nonce(length) {
        var chars = OAuth.nonce.CHARS;
        var result = "";
        for (var i = 0; i < length; ++i) {
            var rnum = Math.floor(Math.random() * chars.length);
            result += chars.substring(rnum, rnum+1);
        }
        return result;
    }
});

OAuth.nonce.CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";

/** Define a constructor function,
    without causing trouble to anyone who was using it as a namespace.
    That is, if parent[name] already existed and had properties,
    copy those properties into the new constructor.
 */
OAuth.declareClass = function declareClass(parent, name, newConstructor) {
    var previous = parent[name];
    parent[name] = newConstructor;
    if (newConstructor != null && previous != null) {
        for (var key in previous) {
            if (key != "prototype") {
                newConstructor[key] = previous[key];
            }
        }
    }
    return newConstructor;
}

/** An abstract algorithm for signing messages. */
OAuth.declareClass(OAuth, "SignatureMethod", function OAuthSignatureMethod(){});

OAuth.setProperties(OAuth.SignatureMethod.prototype, // instance members
{
    /** Add a signature to the message. */
    sign: function sign(message) {
        var baseString = OAuth.SignatureMethod.getBaseString(message);
        var signature = this.getSignature(baseString);
        OAuth.setParameter(message, "oauth_signature", signature);
        return signature; // just in case someone's interested
    }
,
    /** Set the key string for signing. */
    initialize: function initialize(name, accessor) {
        var consumerSecret;
        if (accessor.accessorSecret != null
            && name.length > 9
            && name.substring(name.length-9) == "-Accessor")
        {
            consumerSecret = accessor.accessorSecret;
        } else {
            consumerSecret = accessor.consumerSecret;
        }
        this.key = OAuth.percentEncode(consumerSecret)
             +"&"+ OAuth.percentEncode(accessor.tokenSecret);
    }
});

/* SignatureMethod expects an accessor object to be like this:
   {tokenSecret: "lakjsdflkj...", consumerSecret: "QOUEWRI..", accessorSecret: "xcmvzc..."}
   The accessorSecret property is optional.
 */
// Class members:
OAuth.setProperties(OAuth.SignatureMethod, // class members
{
    sign: function sign(message, accessor) {
        var name = OAuth.getParameterMap(message.parameters).oauth_signature_method;
        if (name == null || name == "") {
            name = "HMAC-SHA1";
            OAuth.setParameter(message, "oauth_signature_method", name);
        }
        OAuth.SignatureMethod.newMethod(name, accessor).sign(message);
    }
,
    /** Instantiate a SignatureMethod for the given method name. */
    newMethod: function newMethod(name, accessor) {
        var impl = OAuth.SignatureMethod.REGISTERED[name];
        if (impl != null) {
            var method = new impl();
            method.initialize(name, accessor);
            return method;
        }
        var err = new Error("signature_method_rejected");
        var acceptable = "";
        for (var r in OAuth.SignatureMethod.REGISTERED) {
            if (acceptable != "") acceptable += '&';
            acceptable += OAuth.percentEncode(r);
        }
        err.oauth_acceptable_signature_methods = acceptable;
        throw err;
    }
,
    /** A map from signature method name to constructor. */
    REGISTERED : {}
,
    /** Subsequently, the given constructor will be used for the named methods.
        The constructor will be called with no parameters.
        The resulting object should usually implement getSignature(baseString).
        You can easily define such a constructor by calling makeSubclass, below.
     */
    registerMethodClass: function registerMethodClass(names, classConstructor) {
        for (var n = 0; n < names.length; ++n) {
            OAuth.SignatureMethod.REGISTERED[names[n]] = classConstructor;
        }
    }
,
    /** Create a subclass of OAuth.SignatureMethod, with the given getSignature function. */
    makeSubclass: function makeSubclass(getSignatureFunction) {
        var superClass = OAuth.SignatureMethod;
        var subClass = function() {
            superClass.call(this);
        };
        subClass.prototype = new superClass();
        // Delete instance variables from prototype:
        // delete subclass.prototype... There aren't any.
        subClass.prototype.getSignature = getSignatureFunction;
        subClass.prototype.constructor = subClass;
        return subClass;
    }
,
    getBaseString: function getBaseString(message) {
        var URL = message.action;
        var q = URL.indexOf('?');
        var parameters;
        if (q < 0) {
            parameters = message.parameters;
        } else {
            // Combine the URL query string with the other parameters:
            parameters = OAuth.decodeForm(URL.substring(q + 1));
            var toAdd = OAuth.getParameterList(message.parameters);
            for (var a = 0; a < toAdd.length; ++a) {
                parameters.push(toAdd[a]);
            }
        }
        return OAuth.percentEncode(message.method.toUpperCase())
         +'&'+ OAuth.percentEncode(OAuth.SignatureMethod.normalizeUrl(URL))
         +'&'+ OAuth.percentEncode(OAuth.SignatureMethod.normalizeParameters(parameters));
    }
,
    normalizeUrl: function normalizeUrl(url) {
        var uri = OAuth.SignatureMethod.parseUri(url);
        var scheme = uri.protocol.toLowerCase();
        var authority = uri.authority.toLowerCase();
        var dropPort = (scheme == "http" && uri.port == 80)
                    || (scheme == "https" && uri.port == 443);
        if (dropPort) {
            // find the last : in the authority
            var index = authority.lastIndexOf(":");
            if (index >= 0) {
                authority = authority.substring(0, index);
            }
        }
        var path = uri.path;
        if (!path) {
            path = "/"; // conforms to RFC 2616 section 3.2.2
        }
        // we know that there is no query and no fragment here.
        return scheme + "://" + authority + path;
    }
,
    parseUri: function parseUri (str) {
        /* This function was adapted from parseUri 1.2.1
           http://stevenlevithan.com/demo/parseuri/js/assets/parseuri.js
         */
        var o = {key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
                 parser: {strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@\/]*):?([^:@\/]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/ }};
        var m = o.parser.strict.exec(str);
        var uri = {};
        var i = 14;
        while (i--) uri[o.key[i]] = m[i] || "";
        return uri;
    }
,
    normalizeParameters: function normalizeParameters(parameters) {
        if (parameters == null) {
            return "";
        }
        var list = OAuth.getParameterList(parameters);
        var sortable = [];
        for (var p = 0; p < list.length; ++p) {
            var nvp = list[p];
            if (nvp[0] != "oauth_signature") {
                sortable.push([ OAuth.percentEncode(nvp[0])
                              + " " // because it comes before any character that can appear in a percentEncoded string.
                              + OAuth.percentEncode(nvp[1])
                              , nvp]);
            }
        }
        sortable.sort(function(a,b) {
                          if (a[0] < b[0]) return  -1;
                          if (a[0] > b[0]) return 1;
                          return 0;
                      });
        var sorted = [];
        for (var s = 0; s < sortable.length; ++s) {
            sorted.push(sortable[s][1]);
        }
        return OAuth.formEncode(sorted);
    }
});

OAuth.SignatureMethod.registerMethodClass(["PLAINTEXT", "PLAINTEXT-Accessor"],
    OAuth.SignatureMethod.makeSubclass(
        function getSignature(baseString) {
            return this.key;
        }
    ));

OAuth.SignatureMethod.registerMethodClass(["HMAC-SHA1", "HMAC-SHA1-Accessor"],
    OAuth.SignatureMethod.makeSubclass(
        function getSignature(baseString) {
            b64pad = '=';
            var signature = b64_hmac_sha1(this.key, baseString);
            return signature;
        }
    ));

try {
    OAuth.correctTimestampFromSrc();
} catch(e) {
}
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
  return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1(key, data)
{
  var bkey = str2binb(key);
  if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
  return core_sha1(opad.concat(hash), 512 + 160);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words
 * In 8-bit function, characters >255 have their hi-byte silently ignored.
 */
function str2binb(str)
{
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
  return bin;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2str(bin)
{
  var str = "";
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
  return str;
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
  }
  return str;
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64(binarray)
{
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
  }
  return str;
}
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
};/* Copyright (c) 2010-2012 Marcus Westin */
;(function(){function h(){try{return d in b&&b[d]}catch(a){return!1}}function i(){try{return e in b&&b[e]&&b[e][b.location.hostname]}catch(a){return!1}}var a={},b=window,c=b.document,d="localStorage",e="globalStorage",f="__storejs__",g;a.disabled=!1,a.set=function(a,b){},a.get=function(a){},a.remove=function(a){},a.clear=function(){},a.transact=function(b,c){var d=a.get(b);typeof d=="undefined"&&(d={}),c(d),a.set(b,d)},a.serialize=function(a){return JSON.stringify(a)},a.deserialize=function(a){return typeof a!="string"?undefined:JSON.parse(a)};if(h())g=b[d],a.set=function(b,c){if(c===undefined)return a.remove(b);g.setItem(b,a.serialize(c))},a.get=function(b){return a.deserialize(g.getItem(b))},a.remove=function(a){g.removeItem(a)},a.clear=function(){g.clear()};else if(i())g=b[e][b.location.hostname],a.set=function(b,c){if(c===undefined)return a.remove(b);g[b]=a.serialize(c)},a.get=function(b){return a.deserialize(g[b]&&g[b].value)},a.remove=function(a){delete g[a]},a.clear=function(){for(var a in g)delete g[a]};else if(c.documentElement.addBehavior){var j,k;try{k=new ActiveXObject("htmlfile"),k.open(),k.write('<script>document.w=window</script><iframe src="/favicon.ico"></frame>'),k.close(),j=k.w.frames[0].document,g=j.createElement("div")}catch(l){g=c.createElement("div"),j=c.body}function m(b){return function(){var c=Array.prototype.slice.call(arguments,0);c.unshift(g),j.appendChild(g),g.addBehavior("#default#userData"),g.load(d);var e=b.apply(a,c);return j.removeChild(g),e}}a.set=m(function(b,c,e){if(e===undefined)return a.remove(c);b.setAttribute(c,a.serialize(e)),b.save(d)}),a.get=m(function(b,c){return a.deserialize(b.getAttribute(c))}),a.remove=m(function(a,b){a.removeAttribute(b),a.save(d)}),a.clear=m(function(a){var b=a.XMLDocument.documentElement.attributes;a.load(d);for(var c=0,e;e=b[c];c++)a.removeAttribute(e.name);a.save(d)})}try{a.set(f,f),a.get(f)!=f&&(a.disabled=!0),a.remove(f)}catch(l){a.disabled=!0}typeof module!="undefined"?module.exports=a:typeof define=="function"&&define.amd?define(a):this.store=a})()/*

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

function augment (c, b) {
  for (var k in b) {
    if (Object.prototype.hasOwnProperty.call(b, k) && b[k] != null) {
      c[k] = b[k];
    }
  }
  return c;
}

function safeJSONStringify (data) {
  return JSON.stringify(data).replace(/[\u007f-\uffff]/g, function (c) {
    return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

var Middleware = (function () {

  function Middleware () { }

  Middleware.prototype.use = function (callback) {
    (this._middleware || (this._middleware = [])).push(callback);
    return this;
  };

  // Ensured to happen on next event loop at earliest.
  Middleware.prototype.middleware = function () {
    var args = Array.prototype.slice.call(arguments), next = args.pop();
    var fns = (this._middleware || []).slice();
    function nextCallback() {
      if (fns.length == 0) {
        env.nextTick(next);
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
 * Environment
 */

var envtype = (typeof module !== 'undefined' && module.exports) ? 'node' : 'browser';

// Require the rem environment-specific code.
if (envtype == 'node') {
  var env = require('./node/env');
}


/**
 * Module
 */

var rem = (envtype == 'node') ? exports : this.rem = {};

// Configuration.
rem.userAgent = 'Mozilla/5.0 (compatible; REMbot/1.0; +http://remlib.org/)';

rem.env = env;



/**
 * CrossStream
 */

env.inherits(QueueStream, env.Stream);

/** @constructor */
function QueueStream () {
  this._buffer = [];
  this.readable = this.writable = this.paused = true;
  this.ended = this.endedEmitted = this.cache = false;
  this.index = 0;
}

QueueStream.prototype.pause = function () {
  this.paused = true;
};

QueueStream.prototype.resume = function () {
  this.paused = false;
  while (this.index < this._buffer.length) {
    this.emit('data', this._buffer[this.index++]);
  }
  if (!this.cache) {
    this._buffer = [];
    this.index = 0;
  }
  if (this.ended && !this.endedEmitted) {
    this.end();
  }
};

QueueStream.prototype.write = function (data) {
  this._buffer.push(data);
  if (!this.paused) {
    this.emit('data', this.cache ? data : this._buffer.pop());
  }
  return true;
};

QueueStream.prototype.end = function (data) {
  if (data) {
    this.write(data);
  }
  this.ended = true;
  if (!this.paused) {
    this.emit('end');
    this.endedEmitted = true;
  }
};

QueueStream.prototype.toBuffer = function () {
  return env.concatList(this._buffer);
}

env.inherits(CrossStream, env.EventEmitter);

/** @constructor */
function CrossStream () {
  this.input = new QueueStream(); this.writable = true;
  this.output = new QueueStream(); this.readable = true;

  // Writeable input
  ['error', 'close', 'drain', 'pipe'].forEach(function (event) {
    this.on(event, this.input.emit.bind(this.input, event));
  }.bind(this));
  ['write', 'end'].forEach(function (event) {
    this[event] = this.input[event].bind(this.input);
  }.bind(this));
  
  // Readable output
  ['error', 'close', 'data', 'end'].forEach(function (event) {
    this.output.on(event, this.emit.bind(this, event));
  }.bind(this));
  ['pause', 'resume', 'pipe'].forEach(function (event) {
    this[event] = this.output[event].bind(this.output);
  }.bind(this));
}

/**
 * Data formats.
 */

rem.serializer = {
  json: function (data) {
    return safeJSONStringify(data);
  },

  form: function (data) {
    return env.qs.stringify(data);
  }
};

rem.parsers = {
  stream: function (res, next) {
    next(null, res);
  },

  binary: function (res, next) {
    env.consumeStream(res, function (stream) {
      next(null, stream);
    });
  },

  text: function (res, next) {
    env.consumeStream(res, function (data) {
      // Strip BOM signatures.
      next(null, String(data).replace(/^\uFEFF/, ''));
    });
  },

  json: function (res, next) {
    rem.parsers.text(res, function (err, data) {
      if (err || !data.length) {
        return next(err);
      }
      try {
        var json = JSON.parse(String(data));
      } catch (e) {
        var err = new SyntaxError('Could not parse JSON response: ' + e.message + '\n' + data);
        err.stack = e.stack;
        next(err, null);
      }
      next(null, json);
    });
  },

  xml: function (res, next) {
    rem.parsers.text(res, function (err, data) {
      if (err || !data.length) {
        return next(err);
      }
      var parseSuccessful = false;
      try {
        env.parseXML(data, function (xml) {
          parseSuccessful = true;
          next(null, xml);
        });
      } catch (e) {
        if (parseSuccessful) {
          throw e;
        }
        var err = new SyntaxError('Could not parse XML response: ' + e.message + '\n' + data);
        err.stack = e.stack;
        next(err, null);
      }
    });
  }
};


/** 
 * URL model
 * protocol://auth@hostname:port/pathname?query#hash
 */

rem.URL = URL;

/** @constructor */
function URL (str) {
  this.protocol = undefined;
  this.auth = undefined;
  this.hostname = undefined;
  this.port = undefined;
  this.pathname = undefined;
  this.query = {};
  this.hash = undefined;
  if (str) {
    this.parse(str);
  }
}

URL.prototype.getHost = function () {
  return this.hostname && (this.hostname + (this.port ? ':' + this.port : ''));
};

URL.prototype.getPath = function () {
  return this.pathname
    + (env.qs.stringify(this.query) ? '?' + env.qs.stringify(this.query) : '')
    + (this.hash ? '#' + encodeURIComponent(this.hash) : '');
};

URL.prototype.toString = function () {
  return env.formatURL(this);
};

URL.prototype.augment = function (obj) {
  this.protocol = obj.protocol || this.protocol;
  this.auth = obj.auth || this.auth;
  this.hostname = obj.hostname || this.hostname;
  this.port = obj.port || this.port;
  this.pathname = obj.pathname || this.pathname;
  augment(this.query, obj.query); // special
  this.hash = obj.hash || this.hash;
};

URL.prototype.parse = function (str) {
  this.augment(env.parseURL(str));
};

/**
 * ClientRequest functions
 */

rem.ClientRequest = ClientRequest;

/** @constructor */
function ClientRequest () {
  this.method = 'GET';
  this.headers = {};
  this.url = new URL();
  this.body = null;
}

ClientRequest.prototype.setHeader = function (key, value) {
  this.headers[String(key).toLowerCase()] = value;
}

ClientRequest.prototype.getHeader = function (key) {
  return this.headers[String(key).toLowerCase()];
}

ClientRequest.prototype.removeHeader = function (key) {
  return delete this.headers[String(key).toLowerCase()];
}

ClientRequest.prototype.setBody = function (type, body) {
  // Expand payload shorthand.
  if (typeof body == 'object' && !env.isList(body)) {
    if (type == 'form' || type == 'application/x-www-form-urlencoded') {
      type = 'application/x-www-form-urlencoded';
      body = rem.serializer.form(body);
    }
    if (type == 'json' || type == 'application/json') {
      type = 'application/json';
      body = rem.serializer.json(body);
    }
  }

  this.setHeader('Content-Length', body.length);
  this.setHeader('Content-Type', type);
  this.body = body;
}

ClientRequest.prototype.send = function (agent, next) {
  return env.sendRequest(this, agent, next);
}

ClientRequest.prototype.awaitingStream = function () {
  return !this.body && ['PUT', 'POST', 'PATCH'].indexOf(this.method) != -1;
}


/**
 * An HTTP route.
 */

var Route = (function () {

  function Route (url, defaultBodyMime, callback) {
    this.url = url;
    this.defaultBodyMime = defaultBodyMime || 'json';
    this.callback = callback; // sends the request, returns stream
    this.routeMiddleware = function (req, next) {
      next();
    };
  }

  Route.prototype.use = function (fn) {
    var outer = this.routeMiddleware;
    this.routeMiddleware = function (req, next) {
      outer(req, function () {
        fn(req, next);
      })
    }
    return this;
  };

  Route.prototype.headers = function (hash) {
    return this.use(function (req, next) {
      for (var name in hash) {
        req.headers[name] = hash[name];
      }
      next();
    });
  };

  [['get', 'GET'], ['head', 'HEAD'], ['del', 'DELETE']].forEach(function (_) {
    var key = _[0], method = _[1];
    Route.prototype[key] = function (query, next) {
      if (typeof query == 'function') next = query, query = null;

      var req = new ClientRequest();
      req.url.augment(this.url);
      req.method = method;
      augment(req.url.query, query || {});
      return this.callback(req, this.routeMiddleware, next);
    };
  });

  [['post', 'POST'], ['put', 'PUT'], ['patch', 'PATCH']].forEach(function (_) {
    var key = _[0], method = _[1];
    Route.prototype[key] = function (A, B, C, D) {
      var args = Array.prototype.slice.call(arguments);
      var query, mime, body, next;
      if (typeof args[args.length - 1] == 'function') next = args.pop();
      // Query object must be disambiguated by (possibly null) MIME or body argument.
      if (args.length >= 2 && typeof args[0] == 'object') query = args.shift();
      if (args.length == 2) mime = args.shift();
      body = args.shift();

      var req = new ClientRequest();
      req.url.augment(this.url);
      req.method = method;

      // We default to "body" for ambiguous string arguments.
      // If we receive a pipe, we later interpret argument as MIME.
      req._explicitMime = mime != null;

      req.method = method;
      augment(req.url.query, query || {});
      if (body) {
        req.setBody(mime || this.defaultBodyMime, body)
      }
      return this.callback(req, this.routeMiddleware, next);
    };
  });

  return Route;

})();

/**
 * Client
 */

var Client = (function () {

  env.inherits(Client, Middleware);

  function Client (options) {
    // Parsers and format invocation.
    this.parsers = {};
    Object.keys(rem.parsers).forEach(function (format) {
      this.parsers[format] = rem.parsers[format];
      // Cannot bind at construction due to Callable() != this;
      this[format] = function () {
        return this._request.bind(this, format).apply(this, arguments);
      }
    }.bind(this));

    // Default options.
    this.options = { format: 'json' };
    if (options) {
      this.configure(options);
    }

    // User agent.
    this.use(function (req, next) {
      req.headers['user-agent'] = req.headers['user-agent'] || rem.userAgent;
      next();
    });
  }

  Client.prototype.configure = function (options) {
    augment(this.options, options);

    return this;
  };

  // (private)
  // Request as a given format.
  Client.prototype._request = function (format /*, segments... */) {
    var segments = Array.prototype.slice.call(arguments, 1);

    // Combine query arguments and URL path segments.
    var query = typeof segments[segments.length - 1] == 'object' ? segments.pop() : {};
    var url = ((segments[0] || '').indexOf('//') != -1 ? segments.shift() : (segments.length ? '/' : ''))
      + (segments.length ? env.joinPath.apply(null, segments) : '');
    url = new URL(url);
    augment(url.query, query);

    return new Route(url, this.options.uploadFormat, function (req, routeMiddleware, next) {
      var stream = new CrossStream();

      // Disambiguate between MIME type and string body in route invocation.
      function disambiguateInvocation() {
        if (req.body && !req._explicitMime) {
          req.setHeader('Content-Type', req.body);
          req.removeHeader('Content-Length');
          req.body = null;
        }
      }
      stream.once('pipe', disambiguateInvocation);
      env.nextTick(stream.removeListener.bind(stream, 'pipe', disambiguateInvocation));

      // Call request middleware.
      this.middleware(req, function () {
        routeMiddleware(req, function () {
          // Debug capability.
          if (this.debug) {
            console.error(String(req.method).green, String(req.url).grey,
              req.body ? ('[body: ' + (req.body.length ? req.body.length + ' bytes' : 'stream') + ']').grey : '');
          }

          this.send(req, stream, debugResponse(this, function (err, res) {
            stream.output.resume();
            res.pipe(stream.output);
            stream.emit('response', res);
            this.parsers[format](res, function (syntaxerr, data) {
              var err = syntaxerr || (res.statusCode >= 400 ? res.statusCode : 0);
              next && next.call(this, err, data, res);
              stream.emit('return', err, data, res);
            });
          }.bind(this)));
        }.bind(this));
      }.bind(this));

      return stream;
    }.bind(this));
  }

  function debugResponse (api, next) {
    return function (err, res) {
      if (api.debug) {
        if (res) {
          console.error(String(res.statusCode).green,
            ('[type: ' + String(res.headers['content-type']) + ']').grey,
            ('[body: ' + String(res.headers['content-length']) + ']').grey);
        } else {
          console.error('ERROR'.green, String(err).grey)
        }
      }

      next.apply(this, arguments);
    };
  }

  // Methods.

  Client.prototype.call = function () {
    return this._request.bind(this, this.options.format).apply(this, arguments);
  };

  Client.prototype.send = function (req, stream, next) {
    var reqstream = req.send(this.agent, next);
    if (!req.awaitingStream()) {
      if (req.body != null) {
        reqstream.write(req.body);
      }
      reqstream.end();
    } else {
      stream.input.pipe(reqstream);
      stream.input.resume();
    }
  };

  // Throttling.

  Client.prototype.throttle = function (rate) {
    // Unthrottle with api.throttle(null)
    if (rate == null) {
      this.send = this._send || this.send;
      return this;
    }

    var queue = [];
    setInterval(function () {
      var fn = queue.shift();
      if (fn) {
        fn();
      }
    }, Math.floor(1000 / rate))

    // Replace send function.
    if (!this._send) {
      this._send = this.send;
    }
    this.send = function () {
      var args = arguments;
      queue.push(function () {
        this._send.apply(this, args);
      }.bind(this));
    };

    return this;
  };

  // Return.

  return Client;

})();

// Manifest Client.

var ManifestClient = (function () {

  env.inherits(ManifestClient, Client);

  function ManifestClient (manifest, options) {
    // Define manifst.
    this.manifest = manifest;
    this.manifest.configuration = this.manifest.configuration || ['key', 'secret'];

    // Initialize client and options.
    Client.call(this, options);

    // Response. Expand payload shorthand.
    this.use(function (req, next) {
      if (this.manifest.base) {
        // Determine base that matches the path name.
        var pathname = req.url.pathname.replace(/^(?!\/)/, '/')
        // Bases can be fixed or an array of (pattern, base) tuples.
        if (env.isList(this.manifest.base)) {
          var base = '';
          this.manifest.base.some(function (tuple) {
            if (pathname.match(new RegExp(tuple[0]))) {
              base = tuple[1];
              return true;
            }
          });
        } else {
          var base = String(this.manifest.base);
        }
        
        // Update the request with base.
        // TODO check for matching base and use it.
        if (base && (req.url.protocol || req.url.hostname)) {
          throw new Error('Full URL request does not match API base URL: ' + String(req.url));
        }
        req.url.augment(new URL(base)); // Incorporate base.
        req.url.pathname = env.joinPath(req.url.pathname, pathname); // Append path.
      }
      // Route root pathname.
      if (this.manifest.basepath) {
        req.url.pathname = this.manifest.basepath + req.url.pathname;
      }
      // Route suffix.
      if (this.manifest.suffix) {
        req.url.pathname += this.manifest.suffix;
      }

      // Route configuration parameters.
      if (this.manifest.configParams) {
        var params = this.manifest.configParams;
        for (var key in params) {
          req.url.query[key] = this.options[this.manifest.configParams[key]];
        }
      }

      // Route static parameters.
      if (this.manifest.params) {
        var params = this.manifest.params;
        for (var key in params) {
          req.url.query[key] = params[key];
        }
      }

      next();
    }.bind(this));
  }

  ManifestClient.prototype.configure = function (options) {
    augment(this.options, options);

    // Load format-specific options from the manifest.
    if (this.manifest.formats) {
      if (!this.manifest.formats[this.options.format]) {
        throw new Error("Format \"" + this.options.format + "\" is not explicitly defined in this manifest. Please specify an available format this API supports.");
      }
      augment(this.manifest, this.manifest.formats[this.options.format]);
    }
    // Upload format.
    this.options.uploadFormat = this.options.uploadFormat || this.manifest.uploadFormat;

    return this;
  };

  // Prompt.

  ManifestClient.prototype.promptAuthentication = function (opts, next) {
    if (!next) next = opts, opts = {};
    env.promptAuthentication(rem, this, opts, next);
    return this;
  };

  ManifestClient.prototype.promptConfiguration = function (next) {
    env.promptConfiguration(rem, this, next);
    return this;
  };

  ManifestClient.prototype.prompt = function (opts, next) {
    if (!next) next = opts, opts = {};
    this.promptConfiguration(function () {
      this.promptAuthentication(opts, function () {
        console.error('');
        next.apply(this, arguments);
      });
    }.bind(this));
    return this;
  };

  return ManifestClient;

})();


/**
 * Public API.
 */

rem.Client = Client;
rem.ManifestClient = ManifestClient;

rem.createClient = function (manifest, opts) {
  if (typeof manifest == 'string') {
    manifest = { base: manifest };
  }
  var api = callable(new ManifestClient(manifest, opts));
  rem.env.oncreate(api);
  return api;
};

function createFromManifest (manifest, path, version, opts) {
  version = version = '*' ? Number(version) || '*' : '*';
  if (!manifest || !manifest[version]) {
    if (version == '*' && manifest) {
      var version = Object.keys(manifest).sort().pop();
      if (!manifest[version]) {
        throw new Error('Unable to find API ' + JSON.stringify(path) + ' version ' + JSON.stringify(Number(version)) + '. For the latest API, use "*".');
      }
    } else if (manifest) {
      throw new Error('Unable to find API ' + JSON.stringify(path) + ' version ' + JSON.stringify(Number(version)) + '. For the latest API, use "*".');
    } else {
      throw new Error('Unable to find API ' + JSON.stringify(path) + '.');
    }
  }
  manifest = manifest[version];
  manifest.version = version;
  return rem.createClient(manifest).configure(opts);
}

rem.connect = function (path, version, opts) {
  return createFromManifest(env.lookupManifestSync(path), path, version, opts);
};

rem.connectAsync = function (path, version, opts, next) {
  if (!next) {
    next = opts;
    opts = {};
  }
  env.lookupManifest(path, function (err, manifest) {
    if (err) {
      next(err);
    } else {
      next(null, createFromManifest(manifest, path, version, opts));
    }
  })
};

/**
 * Default client request methods.
 */

var defaultClient = new rem.Client();

Object.keys(rem.parsers).forEach(function (format) {
  rem[format] = function () {
    return defaultClient[format].apply(defaultClient, arguments);
  };
});

/**
 * Polling
 */

/*
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
*/

/**
 * Includes
 */

if (envtype == 'node') {
  // Authentication methods.
  require('./node/oauth');
  require('./node/basic');
  //require('./node/aws');
}
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