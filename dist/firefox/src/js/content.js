(function() {
    let options = {};
    var imdbCode;
    var insertedTrivia = false;

    if (typeof browser === 'undefined') {
        var browser = chrome;
    }

    const defaultOptions = {
        hideSpoilers: false
    };

    browser.storage.local.get(null, function(op) {
        options = Object.assign(defaultOptions, op);
        init();
    });

    /**
     * Grab IMDb code, start things
     */
    function init() {

        var imdbLink = $('a[data-track-action="IMDb"]').attr('href');
        if (typeof imdbLink !== 'undefined') {
            var rx = /title\/(.*)\/maindetails/g;
            var arr = rx.exec(imdbLink);
            imdbCode = arr[1];
            if (typeof imdbCode !== 'undefined') {
                insertIframe(imdbCode);
            }
        }
    }

    /**
     * insert hidden iframe with imdb trivia page
     * @param imdbCode "tt2332623"
     */
    function insertIframe(imdbCode) {
        $('.review .truncate').append('<iframe id="lb-imdb-iframe" style="display: none;" aria-hidden="true" src="https://www.imdb.com/title/'+imdbCode+'/trivia/?ref_=tt_trv_trv"></iframe>');
    }

    /**
     * Listen to messages coming from the IMDb iframe
     */
    window.addEventListener('message', function(event) {

        // is it a message from the imdb iframe?
        if (typeof event.data.lb_imdb !== "undefined") {

            // data invalid? show error message
            if (typeof event.data.lb_imdb.categories === "undefined" || typeof event.data.lb_imdb.numItems === "undefined") {
                insertFallback(imdbCode);
            } else {
                if (event.data.lb_imdb.numItems > 0) {
                    if (!insertedTrivia) {
                        insertTriviaCategories(event.data.lb_imdb.categories);
                        insertedTrivia = true;
                    }
                }
            }

            document.getElementById("lb-imdb-iframe").remove();
        }

    });


    /**
     * Throw error if param is null. thx to stackbykumbi https://stackoverflow.com/a/69361046/1191375
     * @param v
     * @returns {*}
     */
    function nullthrows(v) {
        if (v == null) throw new Error("it's a null");
        return v;
    }

    /**
     * Append script tag.
     * @param src
     */
    function injectCode(src) {
        const script = document.createElement('script');
        script.src = src;
        script.onload = function() {
            this.remove();
        };
        nullthrows(document.head || document.documentElement).appendChild(script);
    }

    /**
     * only allow links, sanitize href
     * @param html
     * @returns {*}
     */
    function escapeHTML(html) {
        return filterXSS(html, {
            whiteList: {
                a: ['href']
            },
            stripIgnoreTag: true,
            allowCommentTag: false,
            onTagAttr: function(tag, name, value, isWhiteAttr) {
                if (tag === 'a' && name === 'href') {
                    if (value.startsWith('https://letterboxd.com')) {
                        return 'href="' + value + '"';
                    } else {
                        return 'href="javascript:void(0)"';
                    }
                }
            }
        });
    }




    /**
     * Insert trivia as tabbed content
     * @param triviaCategories
     * @example
     * {
     *     "uncategorized": {
     *         "category": "Uncategorized",
     *         "nonSpoilerItems": ["html", "html", ...],
     *         "spoilerItems": [....]
     *     },
     *     "cameo": { ... },
     *     ...
     * }
     */
    function insertTriviaCategories(triviaCategories) {

        var $tabsWrap = $('.col-main #tabbed-content');
        var $tabsListWrap = $tabsWrap.find("header ul");

        // get base path to movie
        var pathArr = window.location.pathname.split("/");
        var basePath = '/' + pathArr[1] + '/' + pathArr[2] + '/';

        // omit "/trivia" from basepath, since letterboxd server doesn't know it
        var $newTab = $('<li><a href="'+basePath+'" data-id="trivia">Trivia</a></li>');

        $newTab.appendTo($tabsListWrap);

        var triviaHTML = '';

        for (let key in triviaCategories) {

            var category = triviaCategories[key];

            //// non-spoilers
            if (category.nonSpoilerItems.length > 0) {
                triviaHTML += '<div class="trivia-list">';
                if (key !== "uncategorized") {
                    triviaHTML += '<h4>' + escapeHTML(category.category) + '</h4>';
                }

                triviaHTML += '<ul>';
                category.nonSpoilerItems.forEach(function(item) {
                    triviaHTML += '<li>' + " " + escapeHTML(replaceLinks(item)) + '</li>';
                });
                triviaHTML += '</ul>';

                triviaHTML += '</div>';
            }


            //// spoilers
            if (!category.spoilerItems || category.spoilerItems.length === 0) {
                continue;
            }

            let cssClass = ' spoiler';
            if (options.hideSpoilers) {
                cssClass += " hidden-list";
            }
            triviaHTML += '<div class="trivia-list' + cssClass + '">';
            triviaHTML += '<h4>' + escapeHTML((category.category !== "Uncategorized" ? category.category + " " : "") + "Spoilers") + '</h4>';

            if (options.hideSpoilers) {
                triviaHTML +=
                    '<div class="show-hidden-list">' +
                    '<a class="show-hidden-list-link" href="#">Show ' +
                    category.spoilerItems.length + ' spoiler' + (category.spoilerItems.length !== 1 ? 's' : '') +
                    '</a>' +
                    '</div>';
            }

            triviaHTML += '<ul>';
            category.spoilerItems.forEach(function(item) {
                triviaHTML += '<li>' + escapeHTML(replaceLinks(item)) + '</li>';
            });
            triviaHTML += '</ul>';

            triviaHTML += '<div class="lb-imdb-info">';
            triviaHTML += '<span class="if-not-hidden-list">Hide spoilers at first?</span>';
            triviaHTML += '<span class="if-hidden-list">Don\'t hide spoilers?</span>';
            triviaHTML += ' Go to <a href="#" class="open-lb-imdb-options">Letterboxd IMDb Trivia Options</a></div>';

            triviaHTML += '</div>';
        }

        let $newTabContent = $('<div id="tab-trivia" class="tabbed-content-block" style="display: none;">' + triviaHTML + '</div>');
        $newTabContent.appendTo($tabsWrap);

        // re-init letterboxd js to recognize new tab. needs to be external js file, inline <script> is frowned upon
        injectCode(browser.runtime.getURL('/js/reload-letterboxd.js'));

        addTriviaEventListener();

    }

    /**
     * Insert fallback link as tabbed content.
     * @param imdbCode "tt0067515"
     */
    function insertFallback(imdbCode) {

        var $tabsWrap = $('.col-main #tabbed-content');
        var $tabsListWrap = $tabsWrap.find("header ul");

        // get base path to movie
        var pathArr = window.location.pathname.split("/");
        var basePath = '/' + pathArr[1] + '/' + pathArr[2] + '/';

        // omit "/trivia" from basepath, since letterboxd server doesn't know it
        var $newTab = $('<li><a href="'+basePath+'" data-id="trivia">Trivia</a></li>');
        $newTab.appendTo($tabsListWrap);

        var iconSrc = browser.runtime.getURL("img/icon-external-link-line-32.png");

        var triviaHTML = '<div class="lb-imdb-fallback"><p><em>Error fetching IMDb trivia. Might be fixed soon. Meanwhile:</em></p><p><a class="lb-imdb-button" href="https://www.imdb.com/title/'+imdbCode+'/trivia" target="_blank">Go to IMDb trivia page <img src="'+iconSrc+'"></a></p></div>';

        var $newTabContent = $('<div id="tab-trivia" class="tabbed-content-block" style="display: none;">' + triviaHTML + '</div>');
        $newTabContent.appendTo($tabsWrap);

        // re-init letterboxd js to recognize new tab
        injectCode(browser.runtime.getURL('/js/reload-letterboxd.js'));

        addTriviaEventListener();
    }

    /**
     * Replace IMDb links with letterboxd search links.
     * @param html
     */
    function replaceLinks(html) {
        $html = $('<span>' + html + '</span>');

        $html.find('a').each(function() {
            var $this = $(this);
            var linkText = $this.text();
            let uri = $this.attr("href");
            var movieRegex = new RegExp('^\/title\/tt[^\/]+(.*)$');

            // if the given link is a movie page go the letterboxd equivalent movie page
            if (movieRegex.test(uri)) {
                var imdbID = uri.split('/').reverse()[1];
                $this.attr('href', 'https://letterboxd.com/imdb/' + imdbID);
            }
            else {
                $this.attr('href', 'https://letterboxd.com/search/' + encodeURIComponent(linkText));
            }
            $this.removeAttr('class');
        })

        return $html.html();
    }

    /**
     * Hide/show spoilers, open options page on click
     */
    function addTriviaEventListener() {
        var $hiddenLists = $('.trivia-list');

        $hiddenLists.each(function() {

            var $this = $(this);
            var $showHiddenListLink = $this.find('.show-hidden-list-link');
            var $openOptions = $this.find('.open-lb-imdb-options');

            $showHiddenListLink.click(function() {
                $this.removeClass('hidden-list');
                return false;
            });

            $openOptions.click(function() {
                browser.runtime.sendMessage({"action": "openOptionsPage"});
                return false;
            });

        });
    }
})();