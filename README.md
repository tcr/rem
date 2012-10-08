# REM. REST easy.

REM is a minimal library to consume REST APIs, constructed around simple
language idioms and manifests for popular libraries that alleviate
differences between between configuration, authentication, and formats.
Getting started with REM is quick and easy.

To use REM with Node.js, install using `npm`:

    npm install rem

And get started:

```
var rem = require('rem');
var gh = rem.load('github', 3.0).prompt();

rem.console(gh, {scope: ["user", "repo"]}, function (err, user) {
  user('user').get(function (err, profile) {
    console.log(profile);
  });
});
```

## Examples

[Examples are provided for each predefined API.](https://github.com/tcr/rem-js/tree/master/examples) These examples can be run from the command line:

    node examples/service/dropbox.js

## Usage

REM includes [configurations for several popular APIs](https://github.com/tcr/rem-schema).
Getting started with a particular API is as simple is specifying the name and API version:

```javascript
var rem = require('rem')
var tw = rem.load('twitter', 1, {
  key: 'YOUR_API_KEY',
  secret: 'YOUR_INNERMOST_API_SECRET'
});
// Get started with version 1 of the Twitter API
```

You can make API requests simply:

```javascript
tw('search').get({q: 'fleetwood mac', rpp: 5}, function(err, json) {
    console.log('There are', json.results.length, 'results for Fleetwood Mac. #awesome');
});
```

OAuth authentication parameters are already included. You can authenticate by using callbacks,
connect middleware, or out-of-band modes when available:

```javascript
var read = require('read');
var oauth = rem.oauth(tw);
tw.start(function (url, token, secret) {
    console.log("Visit:", url);
    read({prompt: "Verification code: "}, function (err, verifier) {
        oauth.complete(verifier, token, secret, function (err, user) {
            // Authenticated calls with the Twitter API can now be made:
            user('statuses/update').post({status: message}, function (err, json) {
            	console.log('Posted a comment:', err, json);
            })
        })
    })
})
```

You can also define and load your own manifests for your own APIs:

```javascript
var yourapi = rem.create({
  base: 'http://your.api/v1', ...
}, {
  format: 'json'
});
```

## Reference

### `rem` module

   * #### rem.load(_id_, _version_, _options_) returns `Api`  
     Load a predefined manifest. The [available list exists in the `rem` repo](https://github.com/timcameronryan/rem). A version parameter is required for each API. The `options` object is a map of values that configure the API, most commonly `key` and `secret`. You can also specify a `format` parameter with the value `"xml"` or `"json"`, which determines what format to use for REST calls. When a format is not specified, `"json"` is assumed.
     
   * #### rem.create(_manifest_, _options_) returns `Api`  
     Create a REM `Api` object using the JSON manifest you supply. The [format of manifests](https://github.com/timcameronryan/rem) is defined in the `rem` repo.

### `Api` object

The `Api` object is callable:

   * #### api(_path_[, _params_]) returns `Route`  
     Returns a route object for the given path, and if specified, query parameters. These parameters can be augmented by method calls, for instance `api('/some/path', {"key1": "A"}).get({"key2": "B"}, function () { ... })` uses both `key1` and `key2`.

### `Route` object

All route methods perform a REST call. Each takes a _callback_ parameter (which can be omitted, for instance to just return the ClientRequest object). The callback receives an `err` argument, a `data` object (which will be a JSON object or a `libxmljs` document), and a `RESTCall` object with additional methods and properties.

   * #### route.get([_params_, ]_callback(err, data, call)_) returns `ClientRequest`  
     Performs a GET request on the given route. Additional query parameters can be specified.

   * #### route.post([_mime_, ]_data_, _callback(err, data, call)_) returns `ClientRequest`  
     Performs a POST request on the given route with the `data` argument, which can be a string, buffer, or object. The `mime` argument can be a MIME type or one of `form` or `json`. If the `mime` argument is omitted, the value is either  `uploadFormat` as defined in the manifest, or `form` by default. If an object is passed as the `data` argument, it will be serialized as either form data or JSON, depending on the MIME type.

   * #### route.post([_mime_, ]_data_, _callback(err, data, call)_) returns `ClientRequest`  
     Performs a PUT request on the given route. See `route.post()`

   * #### route.head(_callback(err, data, call)_) returns `ClientRequest`  
     Performs a HEAD request on the given route. The `data` argument in the callback will be empty. (The `ClientResponse` is saved in the `call.res` parameter.)

   * #### route.del([_mime_, ]_data_, _callback(err, data, call)_) returns `ClientRequest`  
     Performs a DELETE request on the given route.

### `Auth` object

TODO. See the examples/auth folder.

## License

MIT.