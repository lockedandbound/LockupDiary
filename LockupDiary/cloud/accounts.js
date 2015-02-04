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
      return res.send(401, {'success': false, 'message': 'No logged-in user'})
    }
    if (req.body.new_password != req.body.confirm_password) {
      return res.send(400, {'success': false, 'message': 'New password entries do not match.'})
    }
    user.fetch().then(function() {
      Parse.User.logIn(user.getUsername(), req.body.curr_password, {
        success: function(loginUser) {
          loginUser.setPassword(req.body.new_password).save(null, {
            success: function(loginUser) {
              res.send(200, {'success': true, 'message': 'Password changed'});
            },
            error: function(loginUser, error) {
              console.log('ERROR changing password:', error);
              res.send(500, {'success': false, 'message': 'An unknown error occurred; please try again'});
            }
          });
        },
        error: function(loginUser, error) {
          res.send(403, {'success': false, 'message': 'Current password is incorrect'})
        }
      });
    });
  });

  app.get('/reset_password', function(req, res) {
    return res.render('reset_password', {
      error: null
    });
  });

}