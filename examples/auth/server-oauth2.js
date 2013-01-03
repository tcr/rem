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

// When the user is logged in, oauth.session(req) returns an authenticated API.
// Use this to make REST calls on behalf of the user.
app.get('/', function(req, res) {
  var user = oauth.session(req);
  if (!user) {
    res.end("<h1><a href='/login/'>Log in to Facebook with OAuth</a></h1>");
    return;
  }

  user('me').get(function (err, json) {
    res.write('<h1>Hello ' + json.name + '!</h1>');
    res.write('<p>Your profile:</p><pre>')
    res.write(JSON.stringify(json, null, '  '));
    res.end();
  });
});

// Prompt for configuration. In a production setting, you could use
// fb.configure({ key: <your api key>, secret: <your api secret> })
fb.promptConfiguration(function () {
  app.listen(3000);
  console.log('Visit:', "http://localhost:3000/");
});