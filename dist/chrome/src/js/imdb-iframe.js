jQuery(function($) {

    // not in iframe? bail
    if (window.self === window.top) {
        return;
    }

    const $base = $('main.ipc-page-wrapper');


    // show spoilers if they exist
    $('.splr_show button').trigger("click");

    let $paginationContainer;


    // click on all "load more" buttons
    function clickLoadMoreButtons() {
        $paginationContainer = $('.pagination-container');
        $paginationContainer.each(function() {
            $paginationContainer.find('.ipc-see-more button').trigger("click");
        });
    }
    clickLoadMoreButtons();

    // buttons get removed once the trivia has loaded. check for that, then parse the data
    const observer = new MutationObserver(function(mutationsList, observer) {

        // if the buttons are removed we are probably finished loading
        // don't look at mutationsList, since the classes seem to be randomized. makes it harder to get the correct elements.
        if (!$('.pagination-container').length) {
            observer.disconnect();
            scrapeData();
        }

        clickLoadMoreButtons();
    });



    // do we have "load more" buttons? if so, listen for changes, then parse trivia. if not, parse trivia
    if ($paginationContainer.length) {
        observer.observe($base[0], {
            childList: true,
            subtree: true
        });
    } else {
        scrapeData();
    }

    function scrapeData() {
        let categories = {};
        let numItems = 0;

        // get the different categories (uncategorized, cameo, ...), each with spoilers and non-spoilers
        $('div[data-testid^="sub-section-"]').each(function() {
            const $section = $(this);

            // for example ["uncategorized"], ["uncategorized", "spoilers], ["cameo"], ["cameo", "spoilers]
            const sectionTypeArr = $section.attr("data-testid").substring(12).split("--");
            const sectionId = sectionTypeArr[0];


            if (sectionTypeArr.length) {

                const isSpoiler = sectionTypeArr.length === 2;

                // category doesn't exist yet? create it
                if (!categories[sectionId]) {
                    categories[sectionId] = {
                        "category": "Uncategorized",
                        "nonSpoilerItems": [],
                        "spoilerItems": []
                    }
                }

                // get proper name of category if it's not "uncategorized"
                if (sectionId !== "uncategorized") {
                    const name = $section.parent().find('.ipc-title__text').text();
                    if (name) {
                        categories[sectionId].category = name;
                    }
                }

                let items = [];
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

        // send categories up to content.js
        window.parent.postMessage({"lb_imdb" : {categories: categories, numItems: numItems}}, "*");
    }


})