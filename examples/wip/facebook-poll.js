// npm install rem
var rem = require('../..');

// Create Facebook API, prompting for key/secret.
var facebook = rem.connect('facebook', 1).prompt();

// Authenticate user via the console.
rem.console(facebook, function (err, user) {
  // Poll new statuses at an interval of 1 second, finding the array 
  // at the 'data' key and checking the 'date' key for date comparison.
  rem.poll(user('me/statuses'), {
    interval: 1000,
    root: 'data',
    date: 'updated_time'
  }, function (err, json) {
    console.log('# of new statuses:', json.length);
  });
});