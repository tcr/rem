var rem = require('../../rem');

// Create the API.
var cee = rem.load('nonolith', '1');

// Toggle a light.
cee("devices/com.nonolithlabs.cee*", process.argv[2], "output").post({
  mode: 'svmi',
  value: process.argv[3]
}, function(err, json) {
	// ...
});