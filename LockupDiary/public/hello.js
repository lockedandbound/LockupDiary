$(function() {
  $('.timestamp').each(function(index, element) {
    $(this).text(moment($.trim($(this).text())).format("dddd, MMMM Do YYYY, h:mm:ss a"));
  });

  var displayErrorMessage = function(errMsg) {
    $('#changePasswordError').text(errMsg);
    $('#changePasswordError').css('display', 'block');
  };

  var clientSideValidate = function() {
    if ($('#new_password').val() != $('#confirm_password').val()) {
      displayErrorMessage('New password entries do not match.')
      return false;
    }
    return true;
  };

  $('#changePasswordForm').submit(function(event) {
    event.preventDefault();
    if (clientSideValidate()) {
      $.post('/settings/change_password', $('#changePasswordForm').serialize())
        .done(function (data) {
          alert('Password changed');
          $('#changePasswordModal').modal('hide');
        })
        .fail(function (error) {
          if (error.status == 401) {
            window.location.replace('/login');
          }
          else {
            displayErrorMessage(error.responseJSON.message);
          }
        });
    }
  });

  $('#confirm_password').blur(function(e) {
    clientSideValidate();
  });
})