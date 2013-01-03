var fs = require('fs');

var rem = require('..');
var express = require('express');

var app = express();

app.post('/', function (req, res) {
  console.log(req.headers);
  var total = 0;
  req.on('data', function (data) {
    console.log('[' + data.length, 'bytes]');
    total += data.length;
  });
  req.on('end', function () {
    console.log('[eof]');
    res.send('Received ' + total + ' bytes.');
  });
})

app.listen(5678, function () {
  
  fs.createReadStream(__filename).pipe(rem.text('http://localhost:5678').post(function (err, txt, res) {
    console.log('[status ' + res.statusCode + ']');
  })).pipe(process.stdout);

});