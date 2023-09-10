jQuery(function($) {

    // not in iframe? bail
    if (window.self === window.top) {
        return;
    }

    if (typeof browser === 'undefined') {
        var browser = chrome;
    }

    var $base = $('main.ipc-page-wrapper');

    var buttons = {
        'all' : {
                'class'     : 'chained-see-more-button-uncategorized',
            'removed'   : false
        },
        'seeMore' : {
            'class'     : 'single-page-see-more-button-uncategorized',
            'removed'   : false
        }
    };

    buttons.all.selector = "." + buttons.all.class + ' button';
    buttons.seeMore.selector = "." + buttons.seeMore.class + ' button';

    console.log("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    console.log($(buttons.all.selector).length);


    // do we have hidden non-spoiler items?
    if ($(buttons.all.selector).length) {
        //$(buttons.all.selector).trigger("click");
    } else {
        buttons.all.removed = true;
    }


    // also show spoilers if they exist (instant)
    $('.splr_show button').trigger("click");

    // do we have hidden spoiler items?
    if ($(buttons.seeMore.selector).length) {
        //$(buttons.seeMore.selector).trigger("click");
    } else {
        buttons.seeMore.removed = true;
    }

    console.log("hiiiiier");

    console.log(buttons);


    // buttons get removed once the trivia has loaded. check for that, then parse the data
    var observer = new MutationObserver(function(mutationsList, observer) {
        console.log("got some mutations: ", mutationsList);

        // are the buttons removed? don't look at mutationsList, since the classes seem to be randomized, harder to get the correct elements
        if (!$(buttons.all.selector).length) {
            buttons.all.removed = true;
            console.log("all button gone!!!!!!!!!!!!!!");
        } else {
            console.log("all button still exists ", $(buttons.all.selector));
        }
        if (!$(buttons.seeMore.selector).length) {
            buttons.seeMore.removed = true;
        }

        if (buttons.all.removed && buttons.seeMore.removed) {
            observer.disconnect();
            parseTrivia();
        }

    });

    // do we have "load more" buttons? if so, listen for changes, then parse trivia. if not, parse trivia
    if (!buttons.all.removed || !buttons.seeMore.removed) {
        observer.observe($base[0], {
            childList: true,
            subtree: true
        });
    } else {
        parseTrivia();
    }

    setTimeout(parseTrivia, 10000);


    function parseTrivia() {
        console.log("parsing trivia");

        var nonSpoilerItems = [];
        var spoilerItems = [];

        $('div[data-testid="sub-section-uncategorized"] .ipc-list-card .ipc-html-content-inner-div').each(function() {
            nonSpoilerItems.push($(this).html());
        });
        nonSpoilerItems = removeDuplicates(nonSpoilerItems);

        $('div[data-testid="sub-section-uncategorized--spoilers"] .ipc-list-card .ipc-html-content-inner-div').each(function() {
            spoilerItems.push($(this).html());
        });
        spoilerItems = removeDuplicates(spoilerItems);

        console.log("got " + nonSpoilerItems.length + " items and " + spoilerItems.length + " spoilers");

        var c = 0;
        for (var i in nonSpoilerItems) {
            console.log(c + " " + nonSpoilerItems[i]);
            c++;
        }
        console.log("count: ", c);

    }

    function removeDuplicates(arr) {
        return arr.filter((item, index) => {
            return arr.indexOf(item) === index;
        });
    }

    var title = $('h2[data-testid="subtitle"]').text();

    window.parent.postMessage({"lb_imdb" : title}, "*");


})