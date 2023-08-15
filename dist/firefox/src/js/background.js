if (typeof browser === 'undefined') {
    var browser = chrome;
}

browser.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (typeof request.imdbCode !== 'undefined') {
            getIMDBData(request.imdbCode, sendResponse);
            return true;
        }
    }
);

async function getIMDBData(imdbCode, callback) {

    let nonSpoilerItems = await imdbRequest(imdbCode, false)
    let spoilerItems = await imdbRequest(imdbCode, true)

    let data = {
        imdbCode: imdbCode,
        nonSpoilerItems: nonSpoilerItems,
        spoilerItems: spoilerItems
    }

    callback(data);
}

async function imdbRequest(imdbCode, spoilers = false, pagePointer = null) {

    let triviaItems = [];

    var variables = {
        // "after" : "pointer_to_next_page",
        "const": imdbCode,
        "filter":{
            // "categories":["uncategorized"] to limit to categories
            // "spoilers":"EXCLUDE_SPOILERS" or "SPOILERS_ONLY"
        },
        "first":50,
        "isAutoTranslationEnabled": false,
        "locale":"en-US",
        "originalTitleText":false
    }

    if (spoilers) {
        variables.filter.spoilers = "SPOILERS_ONLY";
    } else {
        variables.filter.spoilers = "EXCLUDE_SPOILERS";
    }

    if (pagePointer) {
        variables.after = pagePointer;
    }

    const extensions = {
        "persistedQuery":{
            "sha256Hash": "101651d4fef546dfc31d45f2bf864f588bf4951c8e4720de555d1aa2d9050df2",
            "version":1
        }
    }

    let url = 'https://caching.graphql.imdb.com/?operationName=TitleTriviaPagination';

    url += '&variables=' + encodeURIComponent(JSON.stringify(variables));
    url += '&extensions=' + encodeURIComponent(JSON.stringify(extensions));

    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/graphql+json, application/json'
        }
    });


    if (response.ok) {
        const data = await response.json();

        if (typeof data.data !== "undefined") {
            triviaItems.push(...data.data.title.trivia.edges);

            if (data.data.title.trivia.pageInfo.hasNextPage) {
                let nextPage = await imdbRequest(imdbCode, spoilers, data.data.title.trivia.pageInfo.endCursor);
                triviaItems.push(...nextPage);
            }
        }

    }

    return triviaItems;
}

browser.runtime.onMessage.addListener(function(message) {
    switch (message.action) {
        case "openOptionsPage":
            openOptionsPage();
            break;
        default:
            break;
    }
});

function openOptionsPage() {
    browser.runtime.openOptionsPage();
}
