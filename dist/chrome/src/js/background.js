if (typeof browser === 'undefined') {
    var browser = chrome;
}

// Fallback hash - used if fetching from GitHub fails
const FALLBACK_QUERY_HASH = '16fe8948f4489e0d7f45641919c9b36a7cfb29faeace1910d34f463a0efd973d';

// URL to fetch current hash from GitHub Pages
const HASH_URL = 'https://combatwombat.github.io/lb-imdb/hash.txt';

// Storage key for cached hash
const STORAGE_KEY = 'queryHash';

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[lb-imdb bg] received message:', message);

    // Request from content.js to fetch trivia
    if (message.action === "fetchTrivia") {
        console.log('[lb-imdb bg] fetchTrivia request for', message.imdbCode);
        fetchTriviaViaGraphQL(message.imdbCode)
            .then(data => sendResponse({ success: true, data: data }))
            .catch(err => {
                console.error('[lb-imdb bg] fetchTrivia failed:', err);
                sendResponse({ success: false, error: err.message });
            });
        return true; // Keep channel open for async response
    }

    // Open options page
    if (message.action === "openOptionsPage") {
        browser.runtime.openOptionsPage();
    }
});

/**
 * Get the query hash with caching:
 * 1. Check browser.storage.local for cached hash
 * 2. If not cached, fetch from GitHub Pages
 * 3. Store fetched hash in browser.storage.local
 * 4. If fetch fails, return FALLBACK_QUERY_HASH
 *
 * @param {boolean} forceRefresh - If true, skip cache and fetch fresh hash
 */
async function getQueryHash(forceRefresh = false) {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
        try {
            const stored = await browser.storage.local.get(STORAGE_KEY);
            if (stored[STORAGE_KEY]) {
                console.log('[lb-imdb bg] using cached hash:', stored[STORAGE_KEY]);
                return stored[STORAGE_KEY];
            }
        } catch (e) {
            console.log('[lb-imdb bg] could not read from storage:', e);
        }
    }

    // Fetch from GitHub Pages
    try {
        console.log('[lb-imdb bg] fetching hash from:', HASH_URL);
        const response = await fetch(HASH_URL);
        if (response.ok) {
            const hash = (await response.text()).trim();
            if (hash && hash.length === 64) { // SHA-256 is 64 hex chars
                console.log('[lb-imdb bg] fetched hash:', hash);
                // Cache it
                await browser.storage.local.set({ [STORAGE_KEY]: hash });
                return hash;
            }
        }
    } catch (e) {
        console.log('[lb-imdb bg] could not fetch hash:', e);
    }

    // Fall back to hardcoded hash
    console.log('[lb-imdb bg] using fallback hash');
    return FALLBACK_QUERY_HASH;
}

/**
 * Clear cached hash (call when hash is invalid)
 */
async function clearCachedHash() {
    try {
        await browser.storage.local.remove(STORAGE_KEY);
        console.log('[lb-imdb bg] cleared cached hash');
    } catch (e) {
        console.log('[lb-imdb bg] could not clear cache:', e);
    }
}

/**
 * Main function: Fetch trivia via GraphQL API
 */
async function fetchTriviaViaGraphQL(imdbCode) {
    console.log('[lb-imdb bg] fetching trivia via GraphQL for', imdbCode);

    let queryHash = await getQueryHash();

    try {
        return await fetchTriviaWithHash(imdbCode, queryHash);
    } catch (err) {
        // If hash failed, try fetching a fresh hash from GitHub
        if (err.message.includes('PersistedQueryNotFound')) {
            console.log('[lb-imdb bg] hash invalid, fetching fresh hash...');
            await clearCachedHash();
            queryHash = await getQueryHash(true); // Force refresh

            // If we got the same hash back, it's still invalid - give up
            if (queryHash === FALLBACK_QUERY_HASH) {
                throw new Error('Could not fetch trivia: hash is outdated');
            }

            return await fetchTriviaWithHash(imdbCode, queryHash);
        }
        throw err;
    }
}

/**
 * Fetch trivia using a specific hash
 */
async function fetchTriviaWithHash(imdbCode, queryHash) {
    console.log('[lb-imdb bg] using query hash:', queryHash);

    // Fetch trivia data (spoilers and non-spoilers)
    const [nonSpoilerItems, spoilerItems] = await Promise.all([
        fetchAllTriviaPages(imdbCode, queryHash, false),
        fetchAllTriviaPages(imdbCode, queryHash, true)
    ]);

    console.log('[lb-imdb bg] fetched', nonSpoilerItems.length, 'non-spoiler items and', spoilerItems.length, 'spoiler items');

    // Process into categories
    const categories = processTriviaCategories(nonSpoilerItems, spoilerItems);
    const numItems = nonSpoilerItems.length + spoilerItems.length;

    return { categories, numItems };
}

/**
 * Fetch all trivia pages (handles pagination)
 */
async function fetchAllTriviaPages(imdbCode, queryHash, spoilers, pagePointer = null) {
    let triviaItems = [];

    const variables = {
        "const": imdbCode,
        "filter": {
            "spoilers": spoilers ? "SPOILERS_ONLY" : "EXCLUDE_SPOILERS"
        },
        "first": 50,
        "locale": "en-US",
        "originalTitleText": false
    };

    if (pagePointer) {
        variables.after = pagePointer;
    }

    const extensions = {
        "persistedQuery": {
            "sha256Hash": queryHash,
            "version": 1
        }
    };

    let url = 'https://caching.graphql.imdb.com/?operationName=TitleTriviaPagination';
    url += '&variables=' + encodeURIComponent(JSON.stringify(variables));
    url += '&extensions=' + encodeURIComponent(JSON.stringify(extensions));

    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/graphql+json, application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
        if (data.errors.some(e => e.message?.includes('PersistedQueryNotFound'))) {
            throw new Error('PersistedQueryNotFound - hash may have changed');
        }
        throw new Error('GraphQL errors: ' + JSON.stringify(data.errors));
    }

    if (data.data?.title?.trivia?.edges) {
        triviaItems.push(...data.data.title.trivia.edges);

        // Handle pagination
        if (data.data.title.trivia.pageInfo?.hasNextPage) {
            const nextPage = await fetchAllTriviaPages(
                imdbCode,
                queryHash,
                spoilers,
                data.data.title.trivia.pageInfo.endCursor
            );
            triviaItems.push(...nextPage);
        }
    }

    return triviaItems;
}

/**
 * Process trivia items into categories
 */
function processTriviaCategories(nonSpoilerItems, spoilerItems) {
    const categories = {};

    function processItems(items, itemType) {
        items.forEach(item => {
            const node = item.node;
            const categoryText = node.category?.text || 'Uncategorized';
            const categoryId = node.category?.id || 'uncategorized';
            const html = node.displayableArticle?.body?.plaidHtml || '';

            if (!categories[categoryId]) {
                categories[categoryId] = {
                    category: categoryText,
                    nonSpoilerItems: [],
                    spoilerItems: []
                };
            }

            categories[categoryId][itemType].push(html);
        });
    }

    processItems(nonSpoilerItems, 'nonSpoilerItems');
    processItems(spoilerItems, 'spoilerItems');

    return categories;
}
