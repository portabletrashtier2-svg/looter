const { chromium } = require('playwright');
const { supabase } = require('../lib/supabase');
const { performOCR } = require('../lib/ocr');
const { parseLotteryResults } = require('../lib/parser');

async function scrapeInstagram() {
    console.log('🚀 Starting Instagram Scraper...');
    await cleanupOldResults();

    // Add more profiles here if needed
    const TARGET_PROFILES = [
        'https://www.instagram.com/chiriqui_tica.nacional'
    ];

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Inject cookies once for the context
    const cookieJson = process.env.INSTAGRAM_COOKIES;
    if (cookieJson) {
        try {
            let cookies = JSON.parse(cookieJson);
            cookies = cookies.map(c => {
                const normalized = { ...c };
                if (c.sameSite === 'no_restriction') normalized.sameSite = 'None';
                if (c.sameSite === 'unspecified') normalized.sameSite = 'Lax';
                if (!['Strict', 'Lax', 'None'].includes(normalized.sameSite)) normalized.sameSite = 'Lax';
                return normalized;
            });
            await context.addCookies(cookies);
            console.log('🍪 Session cookies injected successfully.');
        } catch (e) {
            console.error('❌ Failed to inject cookies:', e.message);
        }
    }

    for (const url of TARGET_PROFILES) {
        console.log(`\n📂 Processing Profile: ${url}`);
        const page = await context.newPage();

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Popup bypass
            try {
                const notNow = await page.getByRole('button', { name: /not now|ahora no/i });
                if (await notNow.isVisible()) await notNow.click();
            } catch (e) { }

            await page.waitForSelector('a[href*="/p/"]', { timeout: 30000 });

            const posts = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href*="/p/"]'));
                return anchors.map(a => {
                    const img = a.querySelector('img') || a.parentElement.querySelector('img');
                    return { url: a.href, img: img?.src };
                }).filter(p => p.img && p.url.includes('/p/'));
            });

            console.log(`📸 Found ${posts.length} posts. Scanning top 12 for new results...`);

            for (const post of posts.slice(0, 12)) {
                const postID = post.url.split('/p/')[1].replace('/', '');

                const { data: existing } = await supabase
                    .from('lottery_results')
                    .select('id, data, country')
                    .eq('external_id', postID)
                    .single();

                // If existing and complete (has at least 3 numbers or is junk marked as 'junk'), skip
                const existingNumbers = existing?.data?.numbers || [];
                if (existing && (existingNumbers.length >= 3 || existing.country === 'junk')) {
                    continue;
                }

                if (existing) {
                    console.log(`🔄 Re-processing incomplete result: ${post.url}`);
                } else {
                    console.log(`✨ New result found: ${post.url}`);
                }

                try {
                    // Try Engine 2 first
                    let rawText = await performOCR(post.img, '2');
                    let results = parseLotteryResults(rawText);

                    // Fallback to Engine 1 if less than 3 numbers found for a recognized country
                    if (results.game && results.game !== 'junk' && results.numbers.length < 3) {
                        console.log(`⚠️  Few results with Engine 2 (${results.numbers.length}). Trying Engine 1 fallback...`);
                        const rawTextFallback = await performOCR(post.img, '1');
                        const resultsFallback = parseLotteryResults(rawTextFallback);

                        if (resultsFallback.numbers.length > results.numbers.length) {
                            console.log(`✅ Engine 1 found MORE results (${resultsFallback.numbers.length}). Using it.`);
                            rawText = rawTextFallback;
                            results = resultsFallback;
                        }
                    }

                    // Determine what to save
                    const isLottery = results.game && results.date && results.numbers.length > 0;

                    const payload = {
                        country: isLottery ? results.game : 'junk',
                        draw_date: isLottery ? results.date : '1000-01-01',
                        data: {
                            time: isLottery ? (results.rawTime || 'Manual') : 'none',
                            numbers: isLottery ? results.numbers : []
                        },
                        external_id: postID,
                        raw_ocr: rawText,
                        scraped_at: new Date().toISOString()
                    };

                    let dbOp;
                    if (existing) {
                        dbOp = supabase.from('lottery_results').update(payload).eq('id', existing.id);
                    } else {
                        dbOp = supabase.from('lottery_results').insert([payload]);
                    }

                    const { error } = await dbOp;

                    if (error) {
                        console.error('❌ Database error:', error.message);
                    } else {
                        if (isLottery) {
                            console.log(`✅ ${existing ? 'Updated' : 'Saved'} Result: ${results.game} | ${results.date} | ${results.numbers.join('-')}`);
                        } else {
                            console.log('💾 Market as processed (No lottery data found).');
                        }
                    }
                } catch (innerError) {
                    console.error(`❌ Error parsing post ${postID}:`, innerError.message);
                }
            }
        } catch (error) {
            console.error(`❌ Error scraping ${url}:`, error.message);
            await page.screenshot({ path: `error_${Date.now()}.png` });
        } finally {
            await page.close();
        }
    }

    await browser.close();
    console.log('\n🏁 Scraper process finished.');
}

async function cleanupOldResults() {
    console.log('🧹 Cleaning up old data (Retention: 24h)...');
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase
            .from('lottery_results')
            .delete()
            .lt('created_at', oneDayAgo);

        if (error) console.error('❌ Cleanup failed:', error.message);
        else console.log('✅ Old records deleted successfully.');
    } catch (e) {
        console.error('❌ Error during cleanup:', e.message);
    }
}

module.exports = { scrapeInstagram };
