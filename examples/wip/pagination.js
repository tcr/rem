// npm install rem
var rem = require('../..');

/*
function assembleOffsets (endpoint, callback) {
	var items = [], offset = 0, limit = 25;
	endpoint.get({offset: offset, limit: limit}, withPayload);

	function withPayload (err, json) {
		if (!err) {
			if (json.data) {
				items = items.concat(json.data);
				if (json.data.length) {
					return endpoint.get({offset: offset += 25, limit: limit}, withPayload);
				}
			}
		}
		callback(err, items);
	}
};

function assemblePagination (endpoint, callback) {
	var items = [];
	endpoint.get(withPayload);

	function withPayload (err, json) {
		if (err) {
			callback(err, items);
		} else {
			if (json.data) {
				items = items.concat(json.data);
			}
			if (json.paging && json.paging.next) {
				next(json.paging.next);
			} else {
				callback(err, items);
			}
		}
	}

	function next (url) {
		rem.url(url).get(function (err, res) {
			rem.consume(res, function (data) {
				withPayload(err, JSON.parse(String(data)));
			});
		});
	}
}

rem.assemble = assembleOffsets;
// Create Facebook API, prompting for key/secret.
var facebook = rem.load('facebook', 1).prompt();

// Authenticate user via the console.
rem.console(facebook, function (err, user) {
  // Poll new statuses at an interval of 1 second, finding the array 
  // at the 'data' key and checking the 'date' key for date comparison.
  assemblePagination(user('me/statuses', {limit: 500}), function (err, json) {
  	json.forEach(function (item) {
  		console.log(item.message, item.updated_time);
  	})
  });
});
*/

function assembleOffsets (endpoint, callback) {
	var items = [], max_id = null, count = 200;
	endpoint.get({count: count}, withPayload);

	function withPayload (err, json) {
		if (!err) {
			items = items.concat(json);
			if (json.length) {
				max_id = json[json.length - 1].id;
				return endpoint.\get({max_id: max_id, count: count}, withPayload);
			} else {
				console.log(json);
			}
		}
		callback(err, items);
	}
};

// Create Facebook API, prompting for key/secret.
var twitter = rem.load('twitter', 1.1).prompt();

// Authenticate user via the console.
rem.console(twitter, function (err, user) {
  // Poll new statuses at an interval of 1 second, finding the array 
  // at the 'data' key and checking the 'date' key for date comparison.
  assembleOffsets(user('statuses/user_timeline'), function (err, json) {
  	json.forEach(function (item) {
  		console.log(item.text);
  	})
  	//console.log(json.length);
  });
});