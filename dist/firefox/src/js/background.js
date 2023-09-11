if (typeof browser === 'undefined') {
    var browser = chrome;
}

/**
 * strip csp headers from imdb-requests, so it can be embedded as an iframe
 */
browser.runtime.onInstalled.addListener(() => {
    const RULE = {
        id: 1,
        condition: {
            initiatorDomains: ["letterboxd.com"],
            requestDomains: ["imdb.com"],
            resourceTypes: ["sub_frame"],
        },
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                {header: 'X-Frame-Options', operation: 'remove'},
                {header: 'Frame-Options', operation: 'remove'},
                {header: 'Content-Security-Policy', operation: 'remove'},
            ],
        },
    };
    browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [RULE.id],
        addRules: [RULE],
    }).then(() => {
        //console.log('Rule has been added \\o/');
    }).catch((error) => {
        console.log('error adding rules, lb-imdb:', error);
    });
});


/**
 * strip headers as well, for Firefox Manifest v2
 */
if (typeof browser.webRequest !== "undefined" && typeof browser.webRequest.onHeadersReceived !== "undefined") {
    function stripHeaders(response) {
        let headers = response.responseHeaders.filter(header => {
            let name = header.name.toLowerCase();
            return name !== 'x-frame-options' && name !== 'frame-options' && name !== 'content-security-policy';
        });

        return {responseHeaders: headers};
    }

    browser.webRequest.onHeadersReceived.addListener(
        stripHeaders,
        {urls: ["*://*.imdb.com/*"], types: ["sub_frame", "main_frame"]},
        ["blocking", "responseHeaders"]
    );
}


browser.runtime.onMessage.addListener(function(message) {
    if (message.action === "openOptionsPage") {
        browser.runtime.openOptionsPage();
    }
});