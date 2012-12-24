var assert = require('assert');

var rem = require('..');

rem.json('http://graph.facebook.com/timcameronryan', {somearg: '1'}).get(function (err, json, res) {
  assert.equal(res.url, 'http://graph.facebook.com/timcameronryan?somearg=1', 'Params in query are not being set.');
});