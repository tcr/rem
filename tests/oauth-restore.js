var rem = require('..');

rem.connect('github.com').prompt(function (err, user) {
  user('user').get(function (err, userinfo1) {
    user.saveState(function (state) {
      console.log(state);

      rem.connect('github.com').promptConfiguration(function (err, github) {
        var oauth = rem.oauth(github);
        var user = oauth.restore(state);

        user('user').get(function (err, userinfo2) {
          console.log(userinfo1 && userinfo2 && userinfo1.login == userinfo2.login)
        });
      })
    })
  });
});