var fs = require('fs')
  , path = require('path');

var rem = require('..');

fs.readFile(path.join(__dirname, 'my_image.png'), function (err, buf) {
  rem.connect('dropbox.com').prompt(function (err, user) {
    user('files_put/sandbox/my_image.png').put(
      'image/png',
      buf,
      function (err, json) {
        console.log('After upload:', err, json);
      });
  })
});