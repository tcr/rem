var test = require('tape')
  , rem = require('../');

test('timing test', function (t) {
	t.plan(4);

	t.doesNotThrow(function () {
	    rem.text('http://www.google.com/').get(function (err, out) {
	    	t.notOk(err, 'Error was thrown fetching google.com');
	    })
	}, null, 'Error was thrown from rem.text');

	t.doesNotThrow(function () {
	    rem.json('http://www.google.com/').get(function (err, out) {
	    	t.ok(err, 'Error created when parsing non-JSON body.');
	    })
	}, null, 'Error was thrown from rem.json (parsing non-json)');
});