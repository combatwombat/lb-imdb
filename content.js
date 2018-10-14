var imdbBase = "https://www.imdb.com/";

var imdbLink = $('a[data-track-action="IMDb"]').attr('href');
if (typeof imdbLink !== 'undefined') {
    var rx = /title\/(.*)\/maindetails/g;
    var arr = rx.exec(imdbLink);
    var imdbCode = arr[1];
    if (typeof imdbCode !== 'undefined') {

        getTrivia(imdbCode, function(trivia) {
            if (trivia.length > 0) {
                insertTrivia(trivia);
            }            
        });        
    }
}

/**
 * Get array of trivia html
 * @param {string} imdbCode 
 * @param {function} done 
 */
function getTrivia(imdbCode, done) {
    var trivia = [];
    var imdbTriviaURL = imdbBase + "/title/" + imdbCode + "/trivia";
    $.get(imdbTriviaURL, function(data) {
        var $triviaEls = $(data).find('#trivia_content .list > div');
        $triviaEls.each(function() {
            
            var html = $(this).find('.sodatext').html();
            
            if (typeof html !== 'undefined') {
                // add domain to internal links            
                html = $.trim(html.replace('<a href="/', '<a target="_blank" href="' + imdbBase, html));
                trivia.push(html);               
            }            
        });
        done(trivia);

    }).fail(function() {
        done(trivia);
    });     
}

function insertTrivia(trivia) {
    var $tabsWrap = $('.col-main #tabbed-content');
    var $tabsListWrap = $tabsWrap.find("header ul");

    // get base path to movie
    var pathArr = window.location.pathname.split("/");
    var basePath = '/' + pathArr[1] + '/' + pathArr[2] + '/';

    // omit "/trivia" from basepath, since letterboxd server doesn't know it
    var $newTab = $('<li><a href="'+basePath+'" data-id="trivia">Trivia</a></li>');
    $newTab.appendTo($tabsListWrap);

    
    var triviaHTML = '';
    for (var i = 0, l = trivia.length; i < l; i++) {
        triviaHTML += '<li>' + trivia[i] + '</li>';
    }
    var $newTabContent = $('<div id="tab-trivia" class="tabbed-content-block" style="display: none;"><ul>' + triviaHTML + '</ul></div>');
    $newTabContent.appendTo($tabsWrap);

    // re-init letterboxd js to recognize new tab
    var customJS = 'Bxd().init();';
    var script = document.createElement('script');
    var code = document.createTextNode('(function() {' + customJS + '})();');
    script.appendChild(code);
    (document.body || document.head).appendChild(script);


       
}