const { chromium } = require('playwright');
const { supabase } = require('../lib/supabase');
const { performOCR } = require('../lib/ocr');
const { parseLotteryResults } = require('../lib/parser');

async function scrapeInstagram() {
    console.log('🚀 Starting Instagram Scraper...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        const url = 'https://www.instagram.com/chiriqui_tica.nacional';
        await page.goto(url);

        // Wait for images to load
        await page.waitForTimeout(5000);

        console.log('📸 Scraping results from:', url);

        // Get all post links
        const posts = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors
                .filter(a => a.href.includes('/p/'))
                .map(a => ({
                    url: a.href,
                    img: a.querySelector('img')?.src
                }))
                .filter(p => p.img);
        });

        console.log(`Found ${posts.length} posts. Checking for new results...`);

        // Process only the top 3 most recent posts to avoid heavy OCR usage
        for (const post of posts.slice(0, 3)) {
            const postID = post.url.split('/p/')[1].replace('/', '');

            // Check if processed
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
                // Perform OCR on the thumbnail/image
                const rawText = await performOCR(post.img);
                const results = parseLotteryResults(rawText);

                if (results.game && results.date && results.numbers.length > 0) {
                    console.log(`✅ Parsed: ${results.game} | ${results.date} | ${results.numbers.join('-')}`);

                    // Save to Supabase
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
