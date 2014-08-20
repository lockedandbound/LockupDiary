var _ = require('underscore');

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

// Routes
app.get('/hello', function(req, res) {
  console.log('hello', 'hello', {key: 'value'});
  res.render('hello', { message: 'Congrats, you just set up your app!' });
});

app.get('/', function(req, res) {
  var currentUser = Parse.User.current();
  if (currentUser) {
    currentUser.fetch({
      success: function(param) {
        res.render('hello', {message: 'User ' + currentUser.getUsername() + ' is logged in.'})
      },
      error: function(error) {
        console.error(error);
        res.send(500, 'Error');
      }
    });
  } else {
     res.redirect('/login');
  }
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
  console.log(req.body);
  var sortTime;
  var event = new Event();
  event.set('type', req.body.type);
  if (req.body.type == 'orgasm') {
    var orgasm = new Orgasm();
    orgasm.set('datetime', req.body.orgasmDatetime);
    sortTime = orgasm.get('datetime');
    event.set('event', orgasm);
  }
  else {
    throw new Error("Unrecognized type: " + type)
  }
  event.set(sortTime, sortTime);

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
