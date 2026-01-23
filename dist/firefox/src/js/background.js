if (typeof browser === 'undefined') {
    var browser = chrome;
}

// Store pending trivia requests: tabId -> {resolve, reject, timeout}
const pendingRequests = new Map();

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[lb-imdb bg] received message:', message, 'from tab:', sender.tab?.id);

    // Request from content.js to fetch trivia
    if (message.action === "fetchTrivia") {
        console.log('[lb-imdb bg] fetchTrivia request for', message.imdbCode);
        fetchTriviaViaTab(message.imdbCode)
            .then(data => sendResponse({ success: true, data: data }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep channel open for async response
    }

    // Scraped data coming from imdb-scraper.js in the background tab
    if (message.lb_imdb && sender.tab) {
        console.log('[lb-imdb bg] received scraped data from tab', sender.tab.id, ':', message.lb_imdb.numItems, 'items');
        console.log('[lb-imdb bg] pending requests:', Array.from(pendingRequests.keys()));
        const pending = pendingRequests.get(sender.tab.id);
        if (pending) {
            console.log('[lb-imdb bg] found pending request, resolving');
            clearTimeout(pending.timeout);
            pendingRequests.delete(sender.tab.id);
            browser.tabs.remove(sender.tab.id).catch(() => {}); // DEBUG
            pending.resolve(message.lb_imdb);
        } else {
            console.log('[lb-imdb bg] no pending request found for tab', sender.tab.id);
        }
        return;
    }

    // Scraper asking if it should run
    if (message.action === "shouldScrape" && sender.tab) {
        const shouldRun = pendingRequests.has(sender.tab.id);
        console.log('[lb-imdb bg] shouldScrape request from tab', sender.tab.id, '- answer:', shouldRun);
        sendResponse({ shouldRun: shouldRun });
        return;
    }

    // Open options page
    if (message.action === "openOptionsPage") {
        browser.runtime.openOptionsPage();
    }
});

async function fetchTriviaViaTab(imdbCode) {
    const url = `https://www.imdb.com/title/${imdbCode}/trivia/`;
    console.log('[lb-imdb bg] opening URL:', url);

    return new Promise(async (resolve, reject) => {
        try {
            // Get current tab so we can switch back
            const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true });

            // Create tab as active (so JS runs at full speed - background tabs get throttled)
            const tab = await browser.tabs.create({
                url: url,
                active: true
            });

            // Immediately switch focus back to original tab
            if (currentTab) {
                browser.tabs.update(currentTab.id, { active: true }).catch(() => {});
            }

            // Hide tab on Firefox (if supported)
            if (browser.tabs.hide) {
                browser.tabs.hide(tab.id).catch(() => {});
            }

            // Set up timeout (15 seconds)
            const timeout = setTimeout(() => {
                pendingRequests.delete(tab.id);
                browser.tabs.remove(tab.id).catch(() => {}); // DEBUG
                reject(new Error('Timeout waiting for IMDb trivia'));
            }, 15000);

            // Store the pending request
            pendingRequests.set(tab.id, { resolve, reject, timeout });
            console.log('[lb-imdb bg] created tab', tab.id, ', pending requests:', Array.from(pendingRequests.keys()));

        } catch (err) {
            reject(err);
        }
    });
}
