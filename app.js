$(function(){
    $('time').each(function(){
        var datetime = $(this).attr('datetime');
        $(this).text(moment(datetime).fromNow());
    });
});