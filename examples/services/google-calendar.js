var rem = require('../..');

// Create Google Calendar API, prompting for key/secret.
var gcal = rem.load('google-calendar', 3.0).prompt();

// Authenticate user via the console.
rem.console(gcal, function (err, user) {
  user('users/me/calendarList').get(function(err, json) {
    if (err) { console.log(err); return; }

    // List your calendars.
    console.log('Your calendars:');
    json.items.forEach(function (cal) {
      console.log(' -', cal.summary);
    });
  });
});