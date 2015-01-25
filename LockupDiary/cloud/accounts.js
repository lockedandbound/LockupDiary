module.exports = function(app) {

	app.get('/login', function(req, res) {
		if (Parse.User.current()) {
			return res.redirect('/');
		}
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

	app.get('/settings', function(req, res) {
		var err = req.query.err ? 'Current password is incorrect.' : null;
		var currentUser = Parse.User.current();
	  if (!currentUser) {
	    return res.redirect('/login');
	  }
	  currentUser.fetch().then(function() {
	    res.render('settings', {
	    	user: currentUser,
	    	error: err
	    });
	  });
	});

	app.post('/settings/change_password', function(req, res) {
		var user = Parse.User.current();
	  if (!user) {
	    return res.redirect('/login');
	  }
	  user.fetch().then(function() {
	  	console.log(user.getUsername());
	  	console.log(req.body.curr_password);
	    Parse.User.logIn(user.getUsername(), req.body.curr_password, {
			  success: function(loginUser) {
			    res.redirect('/');
			  },
			  error: function(loginUser, error) {
			  	res.redirect('/settings?err=bad_passsword');
			  }
			});
	  });
	});

}