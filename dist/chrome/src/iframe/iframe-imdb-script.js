jQuery(function($) {

    // not in iframe? bail
    if (window.self === window.top) {
        return;
    }

    if (typeof browser === 'undefined') {
        var browser = chrome;
    }

    var $base = $('main.ipc-page-wrapper');

    // show spoilers if they exist (instant)
    $('.splr_show button').trigger("click");

    var $paginationContainer = $('.pagination-container');

    var allButtonSelector = '.chained-see-more-button-uncategorized button';
    var moreButtonSelector = '.chained-see-more-button-uncategorized button';

    // click on all "All" buttons if they exist. otherwise click on "x more" button
    $paginationContainer.each(function() {

        $allButton = $paginationContainer.find(allButtonSelector);
        $moreButton = $paginationContainer.find(moreButtonSelector);

        if ($allButton.length) {
            $allButton.trigger("click");

        } else if ($moreButton.length) {
            $moreButton.trigger("click");
        }
    });


    // buttons get removed once the trivia has loaded. check for that, then parse the data
    var observer = new MutationObserver(function(mutationsList, observer) {

        // are the buttons removed? don't look at mutationsList, since the classes seem to be randomized, harder to get the correct elements
        if (!$('.pagination-container').length) {
            observer.disconnect();
            parseTrivia();
        }

    });

    // do we have "load more" buttons? if so, listen for changes, then parse trivia. if not, parse trivia
    if ($paginationContainer.length) {
        observer.observe($base[0], {
            childList: true,
            subtree: true
        });
    } else {
        parseTrivia();
    }

    function parseTrivia() {
        var categories = {};
        var numItems = 0;

        // get the different categories (uncategorized, cameo, ...), each with spoilers and non-spoilers
        $('div[data-testid^="sub-section-"]').each(function() {
            var $section = $(this);

            // for example ["uncategorized"], ["uncategorized", "spoilers], ["cameo"], ["cameo", "spoilers]
            var sectionTypeArr = $section.attr("data-testid").substring(12).split("--");
            var sectionId = sectionTypeArr[0];

            if (sectionTypeArr.length) {

                var isSpoiler = sectionTypeArr.length === 2;

                // category doesn't exist yet? create it
                if (!categories[sectionId]) {
                    categories[sectionId] = {
                        "category": "Uncategorized",
                        "nonSpoilerItems": [],
                        "spoilerItems": []
                    }
                }

                // get proper name of category if it's not "uncategorized"
                if (sectionId !== "uncategorized" && !isSpoiler) {
                    var name = $section.prev().find('.ipc-title__text').text();
                    if (name) {
                        categories[sectionId].category = name;
                    }
                }

                var items = [];
                $section.find(".ipc-list-card .ipc-html-content-inner-div").each(function() {
                    items.push($(this).html());
                    numItems++;
                });

                if (isSpoiler) {
                    categories[sectionId].spoilerItems = items;
                } else {
                    categories[sectionId].nonSpoilerItems = items;
                }
            }

        });

        // send categories up the chain to the outer iframe, see iframe-script.js
        window.parent.postMessage({"lb_imdb" : {categories: categories, numItems: numItems}}, "*");
    }


})