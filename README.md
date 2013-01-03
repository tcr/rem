# Rem 0.6

An HTTP Client with middleware, with built-in support for major web services.

To use Rem with Node.js, install using `npm`:

    npm install rem

To use in the browser, include `lib/rem.js`.

## Example

A Github API script that handles all configuration for you, in just 6 lines:

```javascript
var rem = require('rem');
rem.connect('github.com').prompt(function (err, user) {
  user('user').get(function (err, profile) {
    console.log(profile);
  });
});
```

## Documentation

In progress. Check out the Wiki.

## License

MIT.