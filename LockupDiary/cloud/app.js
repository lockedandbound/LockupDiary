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
  return Math.round(msLocked / intervalEnd.diff(intervalStart) * 100).toString();
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

// Routes
app.get('/', function(req, res) {
  var currentUser = Parse.User.current();
  if (!currentUser) {
    return res.redirect('/login');
  }

  currentUser.fetch().then(function(user) {
    var eventQuery = new Parse.Query(Event);
    eventQuery.equalTo('user', currentUser);
    eventQuery.descending('sortTime');
    return eventQuery.collection().fetch();
  }).then(function(events) {
    var locked = false;
    var status, lockupId, first;
    if (events.length > 0) {
      first = events.at(0);
      locked = first.get('type') == 'lockup' && !first.get('event').end_datetime;
    }
    if (locked) {
      status = 'LOCKED';
      lockupId = first.id;
      var lockupDuration = moment.duration(moment().diff(first.get('event').start_datetime));
      var durationStr = '';
      _.each(['years', 'months', 'weeks', 'days', 'hours', 'minutes'], function(unit) {
        if (lockupDuration.get(unit) == 1) {
          durationStr += '1 ' + unit.slice(0, unit.length - 1) + ', ';
        }
        else if (lockupDuration.get(unit) > 1) {
          durationStr += lockupDuration.get(unit) + ' ' + unit + ', ';
        }
      });
      if (durationStr === '') {
        var secs = lockupDuration.get('seconds');
        durationStr += secs + ' second' + (secs != 1 ? 's, ' : ', ');
      }
      status += ' for ' + durationStr.slice(0, durationStr.length - 2);
    }
    else {
      status = 'UNLOCKED';
    }
    
    var end = moment();
    var start = moment(end).subtract(30, 'days');
    var percentLocked = calculatePercentageLocked(start, end, events);
    percentLocked += "%";
    
    var orgasmCount = calculateOrgasmCount(start, end, events);

    res.render('hello', {
      user: currentUser.getUsername(),
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
});

app.get('/signup', function(req, res) {
  res.render('signup', {error: null});
});

app.post('/signup', function(req, res) {
  var user = new Parse.User();
  user.set('username', req.body.username);
  user.set('password', req.body.password);
  user.set('email', req.body.email);

  user.signUp(null, {
    success: function(user) {
      res.redirect('/');
    },
    error: function(user, error) {
      console.error('Error signing up:', error);
      res.render('signup', {error: 'ERROR: ' + error.message});
    }
  });
});

app.post('/events', function(req, res) {
  var user = Parse.User.current();
  if (req.body.type == 'endLockup') {
    new Parse.Query(Event).get(req.body.lockupId).then(function(event) {
      var endTime = moment().toISOString();
      event.get('event').end_datetime = endTime;
      event.set('sortTime', endTime);  // once lockup has ended, sort according to end time
      return event.save();
    }).then(function(event) {
      console.log(event);
      return res.redirect('/');
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
        'notes': req.body.lockupNotes
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
})

app.get('/login', function(req, res) {
  res.render('login', {error: null});
});

app.post('/login', function(req, res) {
  Parse.User.logIn(req.body.username, req.body.password, {
    success: function(user) {
      res.redirect('/');
    },
    error: function(user, error) {
      console.error('Error logging in:', error);
      res.render('login', {error: 'ERROR: ' + error.message});
    }
  });
});

app.get('/logout', function(req, res) {
  Parse.User.logOut();
  res.redirect('/');
});

// Attach the Express app to Cloud Code.
app.listen();
