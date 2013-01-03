var rem = require('../..');

// Create Google Calendar API, prompting for key/secret.
// Authenticate user via the console.
rem.connect('calendar.google.com', 3.0).prompt(function (err, user) {
  user('users/me/calendarList').get(function(err, json) {
    if (err) { console.log(err); return; }

    // List your calendars.
    console.log('Your calendars:');
    json.items.forEach(function (cal) {
      console.log(' -', cal.summary);
    });
  });
});