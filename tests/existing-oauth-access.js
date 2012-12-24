var rem = require('..');
 
if (process.argv.length < 3) {
  console.log('Usage: node tests/existing-oauth-access.js [access token] [access secret]');
  process.exit(1);
}

rem.connect('twitter.com', '1.1').promptConfiguration(function (err, api) {
  rem.oauth(twitter).loadState({
    oauthAccessToken: process.argv[2],
    oauthAccessSecret: process.argv[3]
  }, function (user) {
    user('statuses/home_timeline').get(function (err, json) {
      assert.ok(!err, 'Unable to log in with access token and secret.');
    });
  });
});