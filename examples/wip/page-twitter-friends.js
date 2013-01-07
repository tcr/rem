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

/*
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
*/

function clone (a) {
  return JSON.parse(JSON.stringify(a));
}

function assemble (endpoint, query, next, pool) {
  pool = pool || [];
  console.log('cursor:', query, endpoint);
  endpoint.get(query, function (err, json, res) {
    console.log(err, json, res.headers);
    if (err) {
      next(err, pool);
      return;
    }
    pool.push(json.users);
    if (json.next_cursor) {
      query = clone(query);
      query.cursor = json.next_cursor_str;
      assemble(endpoint, query, next, pool);
    } else {
      next(err, json);
    }
  });
}

// Create Facebook API, prompting for key/secret.
rem.connect('twitter.com', 1.1).prompt(function (err, user) {
  //user.throttle(15/60);

  // Poll new statuses at an interval of 1 second, finding the array 
  // at the 'data' key and checking the 'date' key for date comparison.
  assemble(user('followers/list'), {
    screen_name: 'timcameronryan',
    skip_status: true,
    include_user_entities: false
  }, function (err, users) {
    console.log(users.length);
  });
});