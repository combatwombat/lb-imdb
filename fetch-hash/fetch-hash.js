const puppeteer = require('puppeteer');

const IMDB_TRIVIA_URL = 'https://www.imdb.com/title/tt0120201/trivia/';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';

async function fetchHash() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9'
        });

        let foundHash = null;

        // Listen for TitleTriviaPagination requests
        page.on('request', request => {
            const url = request.url();

            if (url.includes('graphql') && url.includes('TitleTriviaPagination')) {
                try {
                    const urlObj = new URL(url);
                    const extensions = urlObj.searchParams.get('extensions');
                    if (extensions) {
                        const parsed = JSON.parse(extensions);
                        if (parsed.persistedQuery?.sha256Hash) {
                            foundHash = parsed.persistedQuery.sha256Hash;
                        }
                    }
                } catch (e) {}
            }
        });

        await page.goto(IMDB_TRIVIA_URL, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Dismiss cookie consent if present
        await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const btn of btns) {
                if (btn.textContent?.includes('Decline')) {
                    btn.click();
                    return;
                }
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // Click the trivia "Load more" button to trigger GraphQL request
        await page.evaluate(() => {
            const btn = document.querySelector('.pagination-container .ipc-see-more button');
            if (btn) btn.click();
        });

        // Wait for GraphQL request
        await new Promise(r => setTimeout(r, 3000));

        return foundHash;

    } finally {
        await browser.close();
    }
}

fetchHash()
    .then(hash => {
        if (hash) {
            console.log(hash);
            process.exit(0);
        } else {
            console.error('No hash found');
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });
