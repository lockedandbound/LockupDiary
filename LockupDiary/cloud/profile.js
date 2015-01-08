var moment = require('cloud/vendor/moment');

module.exports = function(app) {
  
  app.get('/user/:user/diary', function(req, res) {
    var userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo("username", req.params.user);
    userQuery.first({
      success: function(user) {
        if (!user) {
          return res.send(200, 'No such user');  //TODO: update to 404 once have 404 page
        }
        res.render('diary', {
          user: user,
          currentUser: Parse.User.current(),
          year: moment().year()
        });
      },
      failure: function(error) {
        console.error('Looking up user:', error);
        res.send(500, 'ERROR: ' + error.message);
      }
    });
  });

}