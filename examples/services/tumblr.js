var rem = require('../..');
var read = require('read');

var tumblr = rem.connect('tumblr.com', 2.0).promptConfiguration(function (err) {
  read({prompt: 'Enter a blog name (e.g. "staff"): '}, function (err, name) {
  	tumblr('blog', name + '.tumblr.com', 'posts/text').get(function (err, json) {
  	  console.log('Title:', json.response.blog.title);
  	  console.log('Description:', json.response.blog.description);
  	});
  });
});