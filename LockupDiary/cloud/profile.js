var moment = require('cloud/vendor/moment');

// Data types
var Event = Parse.Object.extend("Event");
var Orgasm = Parse.Object.extend("Orgasm");
var Lockup = Parse.Object.extend("Lockup");

module.exports = function(app) {
  
  app.get('/user/:user/diary/:year?', function(req, res) {
    var currYear = moment().year();
    var year = parseInt(req.params.year) || currYear;

    var userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo("username", req.params.user);
    userQuery.first().then(function(user) {
      if (!user) {
        return res.send(200, 'No such user');  //TODO: update to 404 once have 404 page
      }
      
      var eventQuery = new Parse.Query(Event);
      eventQuery.equalTo('user', user);
      eventQuery.greaterThanOrEqualTo('sortTime', moment().year(year).startOf('year').toISOString());
      eventQuery.lessThan('sortTime', moment().year(year+1).startOf('year').toISOString());
      if (year === currYear) {
        var activeQuery = new Parse.Query(Event);
        activeQuery.equalTo('user', user);
        activeQuery.equalTo('sortTime', 'Z');
        var eventQuery = Parse.Query.or(activeQuery, eventQuery);
      }
      eventQuery.descending('sortTime');
      return eventQuery.collection().fetch();
    }, function(error) {
      console.log('Erorr retrieving user:', error);
      res.send(500, 'ERROR: ' + error.message);
    }).then(function(events) {
      monthMap = {};
      events.each(function(event) {
        var month = event.sortTime === 'Z' ? 'Z' : moment(event.get('sortTime')).month();
        if (!(month in monthMap)) {
          monthMap[month] = [];
        }
        monthMap[month].push(event);
      });

      res.render('diary', {
        username: req.params.user,
        currentUser: Parse.User.current(),
        year: year,
        events: monthMap
      });
    }, function(error) {
      console.log('Error retrieving events:', error);
      res.send(500, 'ERROR: ' + error.message);
    });
  });

}