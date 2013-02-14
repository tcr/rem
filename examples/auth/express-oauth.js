// npm install rem express
var rem = require('rem')
  , express = require('express');

// Create the application. Authentication relies on having session capability.
var app = express();
app.use(express.cookieParser());
app.use(express.session({
  secret: "some arbitrary secret"
}));

app.set('port', process.env.PORT || 3000);
app.listen(app.get('port'));

/**
 * Authentication
 */

// Create the Dropbox API.
var dbox = rem.connect('dropbox.com', 1.0).promptConfiguration(function () {
  // We've prompted the user for our app key/secret.
  console.log("Visit: http://localhost:" + app.get('port') + "/");
});

/*

In a production setting, instead of promptConfiguration(),
you could configure your application keys immediately:

var dbox = rem.connect('dropbox.com', 1.0).configure({
  key: process.env.DROPBOX_KEY,
  secret: process.env.DROPBOX_SECRET,
});

*/

// Create the OAuth interface.
var oauth = rem.oauth(dbox, "http://localhost:3000/oauth/callback/");

// oauth.middleware intercepts the callback url that we set when we
// created the oauth middleware.
app.use(oauth.middleware(function (req, res, next) {
  console.log("User is now authenticated.");
  res.redirect('/');
}));

// oauth.login() is a route to redirect to the OAuth login endpoint.
// Use oauth.login({ scope: ... }) to set your oauth scope(s).
app.get('/login/', oauth.login());

// Logout URL clears the user's session.
app.get('/logout/', oauth.logout(function (req, res) {
  res.redirect('/');
}));

/**
 * Routes
 */

app.get('/', function (req, res) {
  // When the user is logged in, oauth.session(req) returns a Dropbox API
  // uniquely authenticated with the user's credentials.
  var user = oauth.session(req);
  if (!user) {
    res.end("<h1><a href='/login/'>Log in to Dropbox via OAuth</a></h1>");
    return;
  }
   
  // Make some authenticated requests to list user information and the
  // files available in this App's folder.
  user('account/info').get(function (err, json) {
    res.write('<h1>Hello ' + json.display_name + '!</h1>');
    user('metadata/sandbox').get(function (err, json) {
      res.write('<p>These are the files in this App\'s folder:</p><ul>');

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