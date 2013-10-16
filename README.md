# Rem 0.6

An HTTP Client with middleware, with built-in support for major web services.

To use Rem with Node.js, install using `npm`:

    npm install rem

To use in the browser, include `lib/rem.js`.

## Getting Started

A Node.js script to access and configure the Github API, in just 6 lines:

```javascript
var rem = require('rem');
rem.connect('github.com').prompt(function (err, user) {
  user('user').get(function (err, profile) {
    console.log('Hello %s!', profile.name);
  });
});
```

`rem.connect('github.com')` creates a Github API Client. `prompt` asks you for API configuration and prompts you to log in. `user` is an authenticated API that can access [endpoints like `'user'`](http://developer.github.com/v3/users/#get-the-authenticated-user), returning a JSON blob like `profile.name`.

## Documentation

Look at [**the Wiki for API Documentation**](https://github.com/tcr/rem/wiki).

* See [code for popular REST services](https://github.com/tcr/rem/tree/master/examples/services).
* See [code for using Rem to authenticate users](https://github.com/tcr/rem/tree/master/examples/auth) with Express, from the command line, or out-of-band login.
* See [code for using Rem in the browser](https://github.com/tcr/rem/tree/master/examples/browser).

## License

MIT.
