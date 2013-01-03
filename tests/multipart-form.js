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
})

/*
var form = new FormData();
form.append('message', 'Testing from Rem');
form.append('source', fs.createReadStream(path.join(__dirname, 'my_image.png')))

var stream = require('stream');
var util = require('util');

function StringStream() {
  stream.Stream.call(this);
  this.writable = true;
  this.buffer = [];
};
util.inherits(StringStream, stream.Stream);

StringStream.prototype.write = function(data) {
  if (data) {
    this.buffer.push(Buffer.isBuffer(data) ? data : new Buffer(data));
  }
};

StringStream.prototype.end = function(data) {
  this.write(data);
  this.payload = Buffer.concat(this.buffer);
  this.mime = form.getHeaders()['content-type'];
  this.emit('end');
};

var s = new StringStream();
s.on('end', function() {

  rem.connect('facebook.com').prompt(function (err, user) {
    user.debug = true;
    user('me/photos').post(s.mime, s.payload, function (err, json) {
      console.log('After upload:', err, json);
    });
  })

});
form.pipe(s);
*/