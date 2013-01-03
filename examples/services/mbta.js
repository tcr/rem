var rem = require('../..');

var mbta = rem.connect('mbta.com', 2.0);
mbta.debug = true;

function update (line) {
  mbta('rthr', line).get(function (err, json) {
    console.log('%s line update: %s', line.toUpperCase(), new Date());
    json.TripList.Trips.forEach(function (trip) {
      if (trip.Position) {
        console.log('Train #%d headed to %s.\tNext stop: %s in %d seconds',
          trip.Position.Train,
          trip.Destination,
          (trip.Predictions[0] || {}).Stop,
          (trip.Predictions[0] || {}).Seconds);
      }
    });
    console.log('\nNext update in 10 seconds...');
  })
}

// Can pass one of 'red', 'orange', or 'blue'. 
update('orange');
setInterval(update.bind(null, 'orange'), 10000);