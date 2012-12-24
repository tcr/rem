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

// Create the Facebook OAuth 2.0 API.
var fb = rem.connect('facebook.com', 1.0);
var oauth = rem.oauth(fb, "http://localhost:3000/oauth/callback/");

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

// Logout URL clears the user's session.
app.get('/logout/', function (req, res) {
  oauth.clearSession(req, function (url) {
    res.redirect('/');
  });
});

// When the user is logged in, the "req.user" variable is set. This is
// an authenticated api you can use to make REST calls.
app.get('/', function(req, res) {
  if (!req.user) {
    res.end("<h1><a href='/login/'>Log in with OAuth</a></h1>");
    return;
  }

  res.write('<h1>Welcome Facebook user!</h1>');
  req.user('me').get(function(err, json) {
    res.write('<p>Your profile:</p><pre>')
    res.write(JSON.stringify(json, null, '\t'));
    res.end();
  });
});

// Prompt for configuration. In a production setting, you could use
// fb.configure({ key: <your api key>, secret: <your api secret> })
fb.promptConfiguration(function () {
  app.listen(3000);
  console.log('Visit:', "http://localhost:3000/");
});