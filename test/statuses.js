var test = require('tape')

var statuses = [101,102,103,122,200,201,202,203,204,205,206,207,208,226,300,301,302,303,304,305,306,307,308,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,420,422,423,424,426,428,429,431,444,449,450,451,499,500,501,502,503,504,505,506,507,508,509,510,511,598,599];

test('Status code test', function (t) {
	t.plan(statuses.length * 2);

	var rem = require('../')
	  , client = rem.createClient({}, {});

	client.configure({redirect: false});

	statuses.forEach(function (status) {
	    client.stream('http://httpstat.us/', status).get(function (err, out, res) {
	    	t.equals(res.statusCode, status, "Received HTTP status code " + status);
	    	if ((err / 100) | 0 > 3) {
	    		t.ok(err, '4xx, 5xx is error')
	    	} else {
	    		t.notOk(err, '1xx, 2xx, 3xx is success')
	    	}
	    })
	});
});