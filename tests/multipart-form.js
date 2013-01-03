var fs = require('fs')
  , path = require('path');

var rem = require('..')
  , FormData = require('form-data');

rem.connect('facebook.com').prompt(function (err, user) {
  var form = new FormData();
  form.append('message', 'Testing from Rem');
  form.append('source', fs.createReadStream(path.join(__dirname, 'my_image.png')))

  user.debug = true;
  form.pipe(user('me/photos').post(form.getHeaders()['content-type'], function (err, json) {
    console.log('After upload:', err, json);
  }));
});