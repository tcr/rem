var test = require('tape')

test('format test', function (t) {
	t.plan(6);

	var rem = require('../');

	t.doesNotThrow(function () {
		var once = false;
	    rem.text('http://www.google.com/').get(function (err, out) {
	    	t.notOk(once, "rem.text is not called twice.");
	    	once = true;
	    	t.notOk(err, 'Error was thrown fetching google.com');
	    })
	}, null, 'Error was thrown from rem.text');

	t.doesNotThrow(function () {
		var once = false;
	    rem.json('http://www.google.com/').get(function (err, out) {
	    	t.notOk(once, "rem.json is not called twice.");
	    	once = true;
	    	t.ok(err, 'Error created when parsing non-JSON body.');
	    })
	}, null, 'Error was thrown from rem.json (parsing non-json)');
});