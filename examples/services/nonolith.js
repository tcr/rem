var rem = require('../..');

// Create the API.
var cee = rem.connect('nonolith', 1.0);

// Toggle a light.
cee("devices/com.nonolithlabs.cee*", process.argv[2], "output").post({
  mode: 'svmi',
  value: process.argv[3]
}, function  (err, json) {
	// ...
});