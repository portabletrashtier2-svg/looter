const { chromium } = require('playwright');
const { supabase } = require('../lib/supabase');
const { performOCR } = require('../lib/ocr');
const { parseLotteryResults } = require('../lib/parser');

async function scrapeInstagram() {
    console.log('🚀 Starting Instagram Scraper...');

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
                    .select('id')
                    .eq('external_id', postID)
                    .single();

                if (existing) continue;

                console.log(`✨ New result found: ${post.url}`);

                try {
                    const rawText = await performOCR(post.img);
                    const results = parseLotteryResults(rawText);

                    if (results.game && results.date && results.numbers.length > 0) {
                        const { error } = await supabase
                            .from('lottery_results')
                            .insert([{
                                country: results.game,
                                draw_date: results.date,
                                data: { time: 'Manual', numbers: results.numbers },
                                external_id: postID,
                                raw_ocr: rawText
                            }]);

                        if (error) console.error('❌ Insert error:', error.message);
                        else console.log(`✅ Saved: ${results.game} | ${results.date} | ${results.numbers.join('-')}`);
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

module.exports = { scrapeInstagram };
