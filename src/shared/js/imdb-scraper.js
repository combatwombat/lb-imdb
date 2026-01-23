if (typeof browser === 'undefined') {
    var browser = chrome;
}

jQuery(function($) {

    // Ask background script if we should run (only if this tab was opened by extension)
    browser.runtime.sendMessage({ action: "shouldScrape" }).then(response => {
        if (response && response.shouldRun) {
            console.log('[lb-imdb] scraper activated');
            runScraper();
        } else {
            console.log('[lb-imdb] scraper not activated (tab not opened by extension)');
        }
    }).catch(err => {
        console.log('[lb-imdb] scraper not activated (error checking):', err);
    });

    function runScraper() {

    const $base = $('main.ipc-page-wrapper');

    // No trivia content? bail early
    if (!$base.length) {
        console.log('[lb-imdb] no $base found, sending empty data');
        browser.runtime.sendMessage({
            "lb_imdb": {
                categories: {},
                numItems: 0
            }
        }).then(() => console.log('[lb-imdb] empty message sent'))
          .catch(err => console.error('[lb-imdb] failed to send empty message', err));
        return;
    }

    console.log('[lb-imdb] $base found, waiting for trivia page to fully load...');

    // Wait for the trivia page to fully load
    // IMDb does client-side navigation, so we need to wait for the "Trivia" h1 title
    let waitAttempts = 0;
    const maxWaitAttempts = 100; // 10 seconds max

    function waitForContent() {
        waitAttempts++;

        // Check for the Trivia h1 title which appears when page is fully loaded
        const $triviaTitle = $('h1.ipc-title__text').filter(function() {
            return $(this).text().trim() === 'Trivia';
        });
        const $sections = $('div[data-testid^="sub-section-"]');

        console.log('[lb-imdb] wait attempt', waitAttempts, '- title found:', $triviaTitle.length > 0, ', sections:', $sections.length);

        if ($triviaTitle.length > 0 && $sections.length > 0) {
            console.log('[lb-imdb] trivia page fully loaded, proceeding');
            startScraping();
        } else if (waitAttempts >= maxWaitAttempts) {
            console.log('[lb-imdb] timed out waiting for content, scraping anyway');
            startScraping();
        } else {
            setTimeout(waitForContent, 100);
        }
    }

    function startScraping() {
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
    }

    waitForContent();

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

        // send categories to background.js
        console.log('[lb-imdb] scraping done, found', numItems, 'items in', Object.keys(categories).length, 'categories');
        console.log('[lb-imdb] categories:', categories);
        browser.runtime.sendMessage({
            "lb_imdb": {
                categories: categories,
                numItems: numItems
            }
        }).then(() => console.log('[lb-imdb] message sent successfully'))
          .catch(err => console.error('[lb-imdb] failed to send message', err));
    }

    } // end runScraper

});
