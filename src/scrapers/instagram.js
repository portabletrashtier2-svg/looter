const { chromium } = require('playwright');
const { supabase } = require('../lib/supabase');
const { performOCR } = require('../lib/ocr');
const { parseLotteryResults } = require('../lib/parser');

async function scrapeInstagram() {
    console.log('🚀 Starting Instagram Scraper...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Inject cookies if available (Bypass Login Wall)
    const cookieJson = process.env.INSTAGRAM_COOKIES;
    if (cookieJson) {
        try {
            let cookies = JSON.parse(cookieJson);

            // Playwright is strict about sameSite values.
            // Normalize "no_restriction" or "unspecified" to "None" or "Lax"
            cookies = cookies.map(c => {
                const normalized = { ...c };
                if (c.sameSite === 'no_restriction') normalized.sameSite = 'None';
                if (c.sameSite === 'unspecified') normalized.sameSite = 'Lax';
                // Ensure sameSite is one of: Strict, Lax, None
                if (!['Strict', 'Lax', 'None'].includes(normalized.sameSite)) {
                    normalized.sameSite = 'Lax';
                }
                return normalized;
            });

            await context.addCookies(cookies);
            console.log('🍪 Session cookies injected and sanitized successfully.');
        } catch (e) {
            console.error('❌ Failed to parse or inject INSTAGRAM_COOKIES:', e.message);
        }
    }

    const page = await context.newPage();

    try {
        const url = 'https://www.instagram.com/chiriqui_tica.nacional';
        await page.goto(url);

        // Check if we are being redirected to login
        if (page.url().includes('login')) {
            console.warn('⚠️ Redirected to login. Cookies might be expired or invalid.');
        }

        // Wait for the grid of posts to appear
        console.log('⏳ Waiting for post grid to load...');
        await page.waitForSelector('article a[href*="/p/"]', { timeout: 15000 });

        console.log('📸 Scraping results from:', url);

        // Get all post links with a more precise selector
        const posts = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('article a[href*="/p/"]'));
            return anchors.map(a => {
                const img = a.querySelector('img') || a.parentElement.querySelector('img');
                return {
                    url: a.href,
                    img: img?.src
                };
            }).filter(p => p.img);
        });

        console.log(`Found ${posts.length} posts. Checking for new results...`);

        for (const post of posts.slice(0, 3)) {
            const postID = post.url.split('/p/')[1].replace('/', '');

            const { data: existing } = await supabase
                .from('results')
                .select('*')
                .eq('external_id', postID)
                .single();

            if (existing) {
                console.log(`⏭️ Post ${postID} already processed. Skipping.`);
                continue;
            }

            console.log(`✨ New post found! Processing: ${post.url}`);

            try {
                const rawText = await performOCR(post.img);
                const results = parseLotteryResults(rawText);

                if (results.game && results.date && results.numbers.length > 0) {
                    console.log(`✅ Parsed: ${results.game} | ${results.date} | ${results.numbers.join('-')}`);

                    const { error } = await supabase
                        .from('results')
                        .insert([{
                            game_id: results.game,
                            draw_date: results.date,
                            numbers: results.numbers,
                            external_id: postID,
                            raw_ocr: rawText,
                            source: 'instagram'
                        }]);

                    if (error) {
                        console.error('❌ Supabase insert error:', error.message);
                    } else {
                        console.log('💾 Result saved to Master Supabase.');
                    }
                } else {
                    console.warn('⚠️ Could not extract valid results from post.', results);
                }
            } catch (innerError) {
                console.error(`❌ Error processing post ${postID}:`, innerError.message);
            }
        }

    } catch (error) {
        console.error('❌ Error during Instagram scrape:', error);
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeInstagram };
