$(function() {
  $('.timestamp').each(function(index, element) {
    $(this).text(moment($.trim($(this).text())).format("dddd, MMMM Do YYYY, h:mm:ss a"));
  });
})