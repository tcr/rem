var rem = require('../../rem');

var tumblr = rem.load('tumblr', 2.0).prompt();
tumblr('blog/staff.tumblr.com/posts/text').get(function (err, json) {
  console.log(json.response.blog.title + ' - ' + json.response.blog.description);
});