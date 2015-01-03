var _ = require('underscore');
var moment = require('cloud/vendor/moment');

// These two lines are required to initialize Express in Cloud Code.
var express = require('express');
var parseExpressHttpsRedirect = require('parse-express-https-redirect');
var parseExpressCookieSession = require('parse-express-cookie-session');
var app = express();

// Global app configuration section
app.set('views', 'cloud/views');  // Specify the folder to find templates
app.set('view engine', 'ejs');    // Set the template engine
app.use(parseExpressHttpsRedirect());
app.use(express.bodyParser());    // Middleware for reading request body
app.use(express.cookieParser('THIS_IS_A_SECRET'));
app.use(parseExpressCookieSession({ cookie: { maxAge: 3600000 } }));

// Additional routes files
require('cloud/accounts')(app);

var logConstructor = function(builtInLogger) {
  return function() {
    var args = _.map(Array.prototype.slice.call(arguments), function(arg) {
      return JSON.stringify(arg);
    });
    builtInLogger(args.join(' '));
  };
};

console.log = logConstructor(console.log);
console.error = logConstructor(console.error);
console.warn = logConstructor(console.warn);

// Data types
var Event = Parse.Object.extend("Event");
var Orgasm = Parse.Object.extend("Orgasm");
var Lockup = Parse.Object.extend("Lockup");

var calculatePercentageLocked = function(intervalStart, intervalEnd, events) {
  var msLocked = 0;
  events.each(function(event) {
    if (event.get('type') == 'lockup') {
      var start = moment(event.get('event').start_datetime);
      var end = event.get('event').end_datetime ? moment(event.get('event').end_datetime) : null;
      if ((!end || end > intervalStart) || (start < intervalEnd && start > intervalStart)) {
        if (start < intervalStart) {
          start = intervalStart;
        }
        if (!end) {
          end = intervalEnd;
        }
        msLocked += end.diff(start);
      }
    }
  });
  return (msLocked / intervalEnd.diff(intervalStart) * 100).toFixed(1)+"%";
};

var calculateOrgasmCount = function(intervalStart, intervalEnd, events) {
  var orgasms = 0;
  events.each(function(event) {
    if (event.get('type') == 'orgasm') {
      var datetime = moment(event.get('event').datetime);
      if (intervalStart <= datetime && datetime <= intervalEnd) {
        orgasms += 1;
      }
    }
  });
  return orgasms.toString();
};

var getDurationString = function(lockupEvent) {
  var end = moment(lockupEvent.get('event').end_datetime) || moment();
  var lockupDuration = moment.duration(end.diff(lockupEvent.get('event').start_datetime));
  var durationStr = '';
  var weeks = 0;
  _.each(['years', 'months', 'weeks', 'days', 'hours', 'minutes'], function(unit) {
    var num = lockupDuration.get(unit);
    if (unit == 'weeks') {
      num = Math.floor(lockupDuration.get('days') / 7);
      weeks = num;
    }
    if (unit === 'days' && weeks > 0) {
      num -= 7*weeks;
    }
    if (num > 0) {
      var unitStr = num == 1 ? unit.slice(0, unit.length - 1) : unit;
      durationStr += num + ' ' + unitStr + ', ';
    }
  });
  if (durationStr === '') {
    var secs = lockupDuration.get('seconds');
    durationStr += secs + ' second' + (secs != 1 ? 's, ' : ', ');
  }
  return durationStr.slice(0, durationStr.length - 2);
};

// Routes
app.get('/', function(req, res) {
  var currentUser = Parse.User.current();
  if (!currentUser) {
    return res.redirect('/login');
  }
  currentUser.fetch().then(function() {
    renderProfile(currentUser, res);
  });
});

var renderProfile = function(user, res) {
  var end = moment();
  var start = moment(end).subtract(30, 'days');
  var startDay = moment(start).startOf('day');

  var activeQuery = new Parse.Query(Event);
  activeQuery.equalTo('user', user);
  activeQuery.equalTo('sortTime', 'Z');
  
  var recentQuery = new Parse.Query(Event);
  recentQuery.equalTo('user', user);
  recentQuery.lessThanOrEqualTo('sortTime', end.toISOString());
  recentQuery.greaterThanOrEqualTo('sortTime', startDay.toISOString());
  
  var eventQuery = Parse.Query.or(activeQuery, recentQuery);
  eventQuery.descending('sortTime');
  eventQuery.collection().fetch().then(function(events) {
    var locked = false;
    var status, lockupId, first;
    if (events.length > 0) {
      first = events.at(0);
      locked = first.get('type') == 'lockup' && !first.get('event').end_datetime;
    }
    if (locked) {
      status = 'LOCKED for ' + getDurationString(first);
      lockupId = first.id;
    }
    else {
      status = 'UNLOCKED';
    }
    
    
    var percentLocked = calculatePercentageLocked(start, end, events);
    var orgasmCount = calculateOrgasmCount(start, end, events);
    
    res.render('hello', {
      user: user,
      currentUser: Parse.User.current(),
      events: events,
      locked: locked,
      lockupId: lockupId,
      status: status,
      percentLocked: percentLocked,
      orgasmCount: orgasmCount
    });
  }, function(error) {
    console.error(error);
    res.send(500, 'Error');
  });
};

app.get('/user/:user', function(req, res) {
  var userQuery = new Parse.Query(Parse.User);
  userQuery.equalTo("username", req.params.user);
  userQuery.first({
    success: function(user) {
      if (!user) {
        return res.send(200, 'No such user');  //TODO: update to 404 once have 404 page
      }
      renderProfile(user, res);
    },
    failure: function(error) {
      console.error('Looking up user:', error);
      res.send(500, 'ERROR: ' + error.message);
    }
  });
});

app.post('/events', function(req, res) {
  var user = Parse.User.current();
  if (req.body.type == 'endLockup') {
    new Parse.Query(Event).get(req.body.lockupId).then(function(event) {
      var endTime = moment().toISOString();
      event.get('event').end_datetime = endTime;
      event.get('event').duration = getDurationString(event);
      event.get('event').end_notes = req.body.lockupNotes;
      event.set('sortTime', endTime);  // once lockup has ended, sort according to end time
      return event.save();
    }).then(function(event) {
      console.log(event);
      return res.redirect('back');
    });
  }
  else {
    var event = new Event();
    var sortTime, details;
    if (req.body.type == 'orgasm') {
      event.set('type', req.body.type);
      details = {
        'datetime': req.body.orgasmDatetime,
        'notes': req.body.orgasmNotes
      };
      sortTime = req.body.orgasmDatetime;
    }
    else if (req.body.type == 'startLockup') {
      event.set('type', 'lockup');
      var now = moment().toISOString();
      details = {
        'start_datetime': now,
        'datetime': now,
        'keyholder_status': req.body.keyholder,
        'start_notes': req.body.lockupNotes
      };
      sortTime = 'Z';  // sort active lockup first
    }
    else {
      throw new Error("Unrecognized type: " + type)
    }
    event.set('user', user);
    event.set('event', details);
    event.set('sortTime', sortTime);
    var eventAcl = new Parse.ACL(user);
    eventAcl.setPublicReadAccess(true);
    event.setACL(eventAcl);

    event.save(null, {
      success: function(event) {
        // Execute any logic that should take place after the object is saved.
        console.log('New object created with objectId: ' + event.id);
        console.log(event);
      },
      error: function(event, error) {
        // Execute any logic that should take place if the save fails.
        // error is a Parse.Error with an error code and description.
        console.log('Failed to create new object, with error code: ' + error.message);
      }
    });

    res.redirect('/');
  }
});

// Attach the Express app to Cloud Code.
app.listen();
