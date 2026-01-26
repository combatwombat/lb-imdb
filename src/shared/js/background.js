if (typeof browser === 'undefined') {
    var browser = chrome;
}

// Known working hash - updated when IMDb changes their query
// This is the SHA-256 hash of IMDb's TitleTriviaPagination GraphQL query
const FALLBACK_QUERY_HASH = '16fe8948f4489e0d7f45641919c9b36a7cfb29faeace1910d34f463a0efd973d';

// Cache for the GraphQL query hash (persists during browser session)
let cachedQueryHash = null;
let hashValidated = false; // Track if current hash has been validated

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
 * Main function: Fetch trivia via GraphQL API
 */
async function fetchTriviaViaGraphQL(imdbCode) {
    console.log('[lb-imdb bg] fetching trivia via GraphQL for', imdbCode);

    // Try with current hash (fallback or cached)
    let queryHash = cachedQueryHash || FALLBACK_QUERY_HASH;

    try {
        const result = await fetchTriviaWithHash(imdbCode, queryHash);
        hashValidated = true;
        return result;
    } catch (err) {
        // If hash failed and we haven't tried discovering yet
        if (err.message.includes('PersistedQueryNotFound') && queryHash === FALLBACK_QUERY_HASH) {
            console.log('[lb-imdb bg] fallback hash failed, discovering new hash...');
            try {
                queryHash = await discoverQueryHash(imdbCode);
                cachedQueryHash = queryHash;
                const result = await fetchTriviaWithHash(imdbCode, queryHash);
                hashValidated = true;
                return result;
            } catch (discoverErr) {
                console.error('[lb-imdb bg] hash discovery failed:', discoverErr);
                throw new Error('Could not fetch trivia: hash discovery failed');
            }
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
    const categories = processTriviaCate(nonSpoilerItems, spoilerItems);
    const numItems = nonSpoilerItems.length + spoilerItems.length;

    return { categories, numItems };
}

/**
 * Discover the GraphQL query hash by:
 * 1. Fetching the IMDb trivia page HTML
 * 2. Finding the trivia-*.js script
 * 3. Extracting the query and computing SHA-256
 */
async function discoverQueryHash(imdbCode) {
    // Step 1: Fetch the trivia page HTML
    const triviaPageUrl = `https://www.imdb.com/title/${imdbCode}/trivia/`;
    console.log('[lb-imdb bg] fetching trivia page:', triviaPageUrl);

    const htmlResponse = await fetch(triviaPageUrl);
    if (!htmlResponse.ok) {
        throw new Error(`Failed to fetch trivia page: ${htmlResponse.status}`);
    }
    const html = await htmlResponse.text();

    // Step 2: Find the trivia-*.js script URL
    // Looking for: src="https://...cloudfront.net/.../trivia-HASH.js"
    // The URL is served from CloudFront CDN with URL-encoded brackets (%5B, %5D)
    const triviaJsMatch = html.match(/src="(https:\/\/[^"]+\/trivia-[a-f0-9]+\.js)"/);
    if (!triviaJsMatch) {
        throw new Error('Could not find trivia JS bundle in page');
    }

    const triviaJsUrl = triviaJsMatch[1];
    console.log('[lb-imdb bg] found trivia JS:', triviaJsUrl);

    // Step 3: Fetch the JS file
    const jsResponse = await fetch(triviaJsUrl);
    if (!jsResponse.ok) {
        throw new Error(`Failed to fetch trivia JS: ${jsResponse.status}`);
    }
    const jsContent = await jsResponse.text();

    // Step 4: Extract the GraphQL query
    const query = extractGraphQLQuery(jsContent);
    console.log('[lb-imdb bg] extracted query length:', query.length);

    // Step 5: Compute SHA-256 hash
    const hash = await computeSHA256(query);
    console.log('[lb-imdb bg] computed hash:', hash);

    return hash;
}

/**
 * Extract the TitleTriviaPagination query from the JS bundle
 *
 * The query is built using graphql-tag template literals and consists of:
 * 1. The main query (TitleTriviaPagination)
 * 2. TitleTriviaPaginationData fragment
 * 3. TitleTriviaItem fragment
 *
 * We need to extract all three and combine them in the correct order.
 */
function extractGraphQLQuery(jsContent) {
    // The fragments and query are defined in template literals like:
    // (0,S.ZP)`fragment TitleTriviaPaginationData on TriviaConnection { ... }`
    //
    // In the minified JS they appear as multiline strings with \n

    // Extract TitleTriviaPaginationData fragment
    // Pattern: fragment TitleTriviaPaginationData on TriviaConnection { total pageInfo { hasNextPage endCursor } }
    const paginationDataRegex = /fragment\s+TitleTriviaPaginationData\s+on\s+TriviaConnection\s*\{[^}]*total[^}]*pageInfo\s*\{[^}]*hasNextPage[^}]*endCursor[^}]*\}[^}]*\}/;
    const paginationDataMatch = jsContent.match(paginationDataRegex);

    // Extract TitleTriviaItem fragment
    // This is more complex as it has nested braces
    const triviaItemRegex = /fragment\s+TitleTriviaItem\s+on\s+TriviaConnection\s*\{[\s\S]*?edges\s*\{[\s\S]*?node\s*\{[\s\S]*?category\s*\{[\s\S]*?\}\s*\}\s*\}\s*\}/;
    const triviaItemMatch = jsContent.match(triviaItemRegex);

    // Extract the main query
    // query TitleTriviaPagination($const: ID!, ...) { title(id: $const) { trivia(...) { ...fragments } } }
    const queryRegex = /query\s+TitleTriviaPagination\s*\([^)]+\)\s*\{[^}]*title\s*\([^)]*\)\s*\{[^}]*trivia\s*\([^)]*\)\s*\{[^}]*\.\.\.TitleTriviaPaginationData[^}]*\.\.\.TitleTriviaItem[^}]*\}\s*\}\s*\}/;
    const queryMatch = jsContent.match(queryRegex);

    if (!queryMatch) {
        console.error('[lb-imdb bg] Could not find TitleTriviaPagination query');
        throw new Error('Could not find TitleTriviaPagination query in JS');
    }

    if (!paginationDataMatch) {
        console.error('[lb-imdb bg] Could not find TitleTriviaPaginationData fragment');
        throw new Error('Could not find TitleTriviaPaginationData fragment in JS');
    }

    if (!triviaItemMatch) {
        console.error('[lb-imdb bg] Could not find TitleTriviaItem fragment');
        throw new Error('Could not find TitleTriviaItem fragment in JS');
    }

    // Combine in the order they appear in IMDb's code:
    // query + TitleTriviaPaginationData + TitleTriviaItem
    //
    // Note: The exact formatting matters for the hash!
    // Apollo's graphql-tag normalizes the query, so we need to match that normalization.
    // The print() function from graphql-js produces a canonical format.

    const fullQuery = [
        queryMatch[0].trim(),
        paginationDataMatch[0].trim(),
        triviaItemMatch[0].trim()
    ].join('\n');

    console.log('[lb-imdb bg] extracted query parts:', {
        query: queryMatch[0].substring(0, 100) + '...',
        paginationData: paginationDataMatch[0].substring(0, 100) + '...',
        triviaItem: triviaItemMatch[0].substring(0, 100) + '...'
    });

    return fullQuery;
}

/**
 * Compute SHA-256 hash of a string
 */
async function computeSHA256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
        // If persisted query not found, invalidate cache and retry
        if (data.errors.some(e => e.message?.includes('PersistedQueryNotFound'))) {
            console.log('[lb-imdb bg] persisted query not found, invalidating cache');
            cachedQueryHash = null;
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
 * Returns format expected by content.js:
 * {
 *   "uncategorized": { category: "Uncategorized", nonSpoilerItems: [...], spoilerItems: [...] },
 *   "cameo": { category: "Cameo", nonSpoilerItems: [...], spoilerItems: [...] },
 *   ...
 * }
 */
function processTriviaCate(nonSpoilerItems, spoilerItems) {
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
