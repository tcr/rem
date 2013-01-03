var fs = require('fs')
  , path = require('path');

var rem = require('..');

rem.connect('dropbox.com').prompt(function (err, user) {
  fs.createReadStream(path.join(__dirname, 'my_image.png'))
    .pipe(user('files_put/sandbox/my_image.png').put('image/png'))
    .on('return', function (err, json) {
      console.log('\nError code:', err);
    })
    .pipe(process.stdout);
})