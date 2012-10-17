var rem = require('../..');
var read = require('read');

var tumblr = rem.load('tumblr', 2.0).prompt();
read({prompt: 'Enter a blog name (e.g. "staff"): '}, function (err, name) {
	tumblr('blog', name + '.tumblr.com', 'posts/text').get(function (err, json) {
	  console.log('Title:', json.response.blog.title);
	  console.log('Description:', json.response.blog.description);
	});
});