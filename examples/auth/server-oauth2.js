// npm install rem read express
var fs = require('fs');
var rem = require('rem');
var read = require('read');
var express = require('express');

// Create the application. Authentication relies on having session capability.
var app = express();
app.use(express.cookieParser());
app.use(express.session({
  secret: "some arbitrary secret"
}));
app.listen(3000);

// Create the Dropbox OAuth 2.0 API.
var dbox = rem.load('facebook', 1.0).prompt()
var oauth = rem.oauth(dbox, "http://localhost:3000/oauth/callback/");

// The oauth middleware intercepts the callback url that we set when we
// created the oauth middleware.
app.use(oauth.middleware(function (req, res, next) {
  console.log("User is now authenticated.");
  res.redirect('/');
}));

// Login URL calls oauth.startSession, which redirects to an oauth URL.
app.get('/login/', function (req, res) {
  oauth.startSession(req, function (url) {
    res.redirect(url);
  });
});

// When the user is logged in, the "req.user" variable is set. This is
// an authenticated api you can use to make REST calls.
app.get('/', function(req, res) {
  if (!req.user) {
    res.write("<h1>Unauthenticated.</h1>");
    res.end("<a href='/login/'>Log in with OAuth</a>");
  } else {
    res.write('<h1>Authenticated.</h1>');
    req.user('me').get(function(err, json) {
      res.write('<pre>');
      res.write('Your profile: (error ' + err + ')\n');
      res.write(JSON.stringify(json, null, '\t'));
      res.end();
    });
  }
});

console.log('Visit:', "http://localhost:3000/");