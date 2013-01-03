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

// Create the Dropbox OAuth API.
var dbox = rem.connect('dropbox.com', 1.0);
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

// Logout URL clears the user's session.
app.get('/logout/', function (req, res) {
  oauth.clearSession(req, function (url) {
    res.redirect('/');
  });
});

// When the user is logged in, oauth.session(req) returns an authenticated API.
// Use this to make REST calls on behalf of the user.
app.get('/', function (req, res) {
  var user = oauth.session(req);
  if (!user) {
    res.end("<h1><a href='/login/'>Log in to Dropbox with OAuth</a></h1>");
    return;
  }
   
  user('account/info').get(function (err, json) {
    res.write('<h1>Hello ' + json.display_name + '!</h1>');
    user('metadata/sandbox').get(function (err, json) {
      res.write('<p>Files in your App folder:</p><ul>');

      // Get a URL for each file, then end the connection.
      var i = json.contents.length;
      json.contents.forEach(function (file) {
        user('media/sandbox', file.path).get(function (err, json) {
          res.write('<li><a href="' + json.url + '">' + file.path + '</a></li>');
          if (--i == 0) {
            res.end('</ul><hr><a href="/logout/">Logout?</a>');
          }
        });
      });
    });
  });
});

// Prompt for configuration. In a production setting, you could use
// dbox.configure({ key: <your api key>, secret: <your api secret> })
dbox.promptConfiguration(function () {
  app.listen(3000);
  console.log('Visit:', "http://localhost:3000/");
});