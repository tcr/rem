// npm install rem read express
var fs = require('fs');
var rem = require('../../rem');
var read = require('read');
var express = require('express');

var app = express();
app.use(express.cookieParser());
app.use(express.session({
  secret: "some arbitrary secret"
}));
app.listen(3000);

// Create the Dropbox OAuth API.

var dbox = rem.load('dropbox', 1.0).prompt()
var oauth = rem.oauth(dbox, "http://localhost:3000/oauth/callback/");

app.use(oauth.middleware(function(req, res, next) {
  console.log("Authenticated user.");
  return res.redirect('/');
}));

app.get('/login/', function(req, res) {
  return oauth.startSession(req, function(url) {
    return res.redirect(url);
  });
});

app.get('/', function(req, res) {
  if (!req.user) {
    res.write("<h1>Unauthenticated.</h1>");
    return res.end("<a href='/login/'>Log in with OAuth</a>");
  } else {
    res.write('<h1>Authenticated.</h1>');
    return req.user('metadata/sandbox/').get(function(err, json) {
      var f, _i, _len, _ref;
      res.write('<pre>');
      res.write('Sandbox contents: (error ' + err + ')\n');
      res.write(json.contents.map(function (file) {
        return ' - ' + file.path;
      }).join('\n'));
      return res.end();
    });
  }
});

console.log('Visit:', "http://localhost:3000/");