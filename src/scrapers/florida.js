const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { DateTime } = require('luxon');
const { supabase } = require('../lib/supabase');

// Add stealth plugin
chromium.use(StealthPlugin());

async function scrapeFlorida(targetDate = null) {
    const now = targetDate
        ? DateTime.fromISO(targetDate, { zone: 'America/Panama' })
        : DateTime.now().setZone('America/Panama');

    const dateStr = now.toISODate(); // YYYY-MM-DD
    const todayStr = now.toFormat('dd-MM');

    const MAX_RETRIES = 15;
    const RETRY_DELAY_MS = 2 * 60 * 1000; // 2 minutes

    console.log(`🔎 [Florida Noche] Persistent Hunt starting for: ${dateStr} (${todayStr})`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`\n🏹 [Attempt ${attempt}/${MAX_RETRIES}] checking results...`);

        // 1. Check if results already exist (HUNT MODE)
        const { data: existing } = await supabase
            .from('lottery_results')
            .select('id')
            .eq('country', 'USA')
            .eq('draw_date', dateStr)
            .ilike('raw_ocr', '%Florida Noche%')
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`✅ [Florida Noche] Results for ${dateStr} already exist. Stopping Hunt.`);
            return;
        }

        const browser = await chromium.launch({
            headless: true,
            args: ['--disable-blink-features=AutomationControlled']
        });

        try {
            const context = await browser.newContext();
            const page = await context.newPage();

            console.log('🌐 [Florida Noche] Navigating to conectate.com.do...');
            await page.goto('https://www.conectate.com.do/loterias/americanas', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            console.log('⏳ [Florida Noche] Waiting for content boxes (10s)...');
            await page.waitForTimeout(10000);

            const result = await page.evaluate((targetDayMonth) => {
                const blocks = document.querySelectorAll('.game-block');
                for (const block of blocks) {
                    const titleEl = block.querySelector('.game-title span');
                    if (!titleEl) continue;

                    const title = titleEl.innerText.trim();
                    // We only want Florida Noche
                    if (title.includes('Florida') && title.includes('Noche')) {
                        const dateEl = block.querySelector('.session-date');
                        if (dateEl && dateEl.innerText.trim() === targetDayMonth) {
                            const scoreEls = block.querySelectorAll('.score, .session-ball');
                            const numbers = Array.from(scoreEls).map(s => s.innerText.trim()).filter(n => n.length > 0);

                            if (numbers.length >= 3) {
                                return {
                                    title: title,
                                    numbers: numbers.slice(0, 3)
                                };
                            }
                        }
                    }
                }
                return null;
            }, todayStr);

            if (result) {
                console.log(`✨ [Florida Noche] FOUND: ${result.numbers.join('-')}`);
                const { error } = await supabase
                    .from('lottery_results')
                    .insert([{
                        country: 'USA',
                        draw_date: dateStr,
                        data: {
                            time: '9:50 PM', // Official time
                            numbers: result.numbers,
                            original_title: result.title
                        },
                        external_id: `usa-fl-noche-${dateStr}`,
                        raw_ocr: `Florida Noche - Conectate Scrape - ${dateStr} (Attempt ${attempt})`
                    }]);

                if (error) console.error('❌ [Florida Noche] Supabase Error:', error.message);
                else {
                    console.log('💾 [Florida Noche] Result saved to Master Supabase.');
                    await browser.close();
                    return;
                }
            } else {
                console.log(`⚠️ [Florida Noche] Results not published yet on Conectate.`);
            }

        } catch (error) {
            console.error(`❌ [Florida Noche] Scraper Error (Attempt ${attempt}):`, error.message);
        } finally {
            await browser.close();
        }

        if (attempt < MAX_RETRIES) {
            console.log(`😴 [Florida Noche] Waiting ${RETRY_DELAY_MS / 1000} seconds for next try...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }

    console.log(`🛑 [Florida Noche] Reached max retries. Ending hunt for this run.`);
}

module.exports = { scrapeFlorida };
