var imdbLink = $('a[data-track-action="IMDb"]').attr('href');

if (typeof imdbLink !== 'undefined') {
    var rx = /title\/(.*)\/maindetails/g;
    var arr = rx.exec(imdbLink);
    var imdbCode = arr[1];
    if (typeof imdbCode !== 'undefined') {
        chrome.runtime.sendMessage({imdbCode: imdbCode}, gotIMDBHTML);
    }
}

function gotIMDBHTML(html) {
    if (html !== false) {
        var trivia = getTriviaFromHTML(html);
        if (trivia.length > 0 && trivia[0].items.length > 0) {
            insertTrivia(trivia);
        }
    }
}

/**
 * Get array of trivia html, grouped by section
 * [{'items' => [...]}, {'title' => 'Cameo', 'items' => [...]}]
 * @param {string} imdbCode
 * @param {function} done
 */
function getTriviaFromHTML(imdbHTML, done) {
    var trivia = [];

    var $triviaLists = $($.parseHTML(imdbHTML)).find('#trivia_content .list');

    $triviaLists.each(function() {
        var $this = $(this);
        var $header = $this.find('> h4.li_group');

        var title = '';
        if ($header.length) {
            title = $header.text();
        }

        var triviaList = {
            'title': title,
            'items': []
        }

        var $triviaEls = $this.find('> div.soda');
        $triviaEls.each(function() {
            var html = $(this).find('.sodatext').html();
            if (typeof html !== 'undefined') {

                // replace  IMDb links with letterboxd search links
                var $html = $('<span>' + html + '</span>');
                $html.find('a').each(function() {
                    var $this = $(this);
                    var linkText = $this.text();
                    $this.attr('href', 'https://letterboxd.com/search/' + encodeURIComponent(linkText));
                })

                html = $html.html();
                triviaList.items.push(html);
            }
        });
        trivia.push(triviaList);
    });
    return trivia;

}



/**
 * Insert trivia as tabbed content.
 * @param {array} trivia
 */
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

        var cssClass = '';
        if (trivia[i].title.startsWith("Spoiler")) {
            cssClass = ' spoiler';
        }

        triviaHTML += '<div class="trivia-list' + cssClass + '">';

        if (trivia[i].title.length) {
            triviaHTML += '<h4>' + trivia[i].title + '</h4>';

        }
        if (trivia[i].items.length) {
            triviaHTML += '<ul>';
            for (var j = 0, l2 = trivia[i].items.length; j < l2; j++) {
                triviaHTML += '<li>' + trivia[i].items[j] + '</li>';
            }
            triviaHTML += '</ul>';
        }

        triviaHTML += '</div>';
    }


    var $newTabContent = $('<div id="tab-trivia" class="tabbed-content-block" style="display: none;">' + triviaHTML + '</div>');
    $newTabContent.appendTo($tabsWrap);

    // re-init letterboxd js to recognize new tab
    var customJS = 'Bxd().tabbedContent();';
    var script = document.createElement('script');
    var code = document.createTextNode('(function() {' + customJS + '})();');
    script.appendChild(code);
    (document.body || document.head).appendChild(script);
}