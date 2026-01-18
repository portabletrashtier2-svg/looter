const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { DateTime } = require('luxon');
const { supabase } = require('../lib/supabase');
const { enableAdBlocker } = require('../utils/resource-blocker');
const { getRandomUserAgent } = require('../utils/user-agent');

// Add stealth plugin
chromium.use(StealthPlugin());

async function scrapePanama(targetDate = null) {
    const now = targetDate
        ? DateTime.fromISO(targetDate, { zone: 'America/Panama' })
        : DateTime.now().setZone('America/Panama');

    const dateStr = now.toISODate();
    const day = now.day;
    const month = now.month;
    const year = now.year;

    const MAX_RETRIES = 15;
    const RETRY_DELAY_MS = 2 * 60 * 1000; // 2 minutes

    console.log(`🔎 [Panama LNB] Persistent Hunt starting for: ${dateStr}`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`\n🏹 [Attempt ${attempt}/${MAX_RETRIES}] checking results...`);

        // 1. Check if results already exist (HUNT MODE)
        const { data: existing } = await supabase
            .from('lottery_results')
            .select('id')
            .eq('country', 'Panama')
            .eq('draw_date', dateStr)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`✅ [Panama LNB] Results for ${dateStr} already exist. Stopping Hunt.`);
            return;
        }

        const browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        try {
            const context = await browser.newContext({
                userAgent: getRandomUserAgent()
            });
            const page = await context.newPage();

            // Block ads to speed up
            await enableAdBlocker(page);

            // Simple Stealth and Anti-detection
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            // Catch logs from inside evaluate for debugging
            page.on('console', msg => console.log(`[Panama Context] ${msg.text()}`));

            console.log('🌐 [Panama LNB] Navigating to lnb.gob.pa...');

            // Increased timeout to 120s because the site is very slow
            // Using 'commit' to get in fast and then wait for actual elements
            await page.goto('https://www.lnb.gob.pa/', {
                waitUntil: 'commit',
                timeout: 120000
            });

            console.log('⏳ [Panama LNB] Waiting for content... (Max 60s)');

            // Wait for the loader to vanish OR wait for the actual results table
            try {
                // First wait for the containerTablero which holds the values
                await page.waitForSelector('div.containerTablero', {
                    state: 'visible',
                    timeout: 60000
                });
                console.log('✅ [Panama LNB] Results table detected.');
            } catch (e) {
                console.log('⚠️ [Panama LNB] Timeout waiting for table, trying to parse current state anyway.');
            }

            // Extra breath to ensure animations finished
            await page.waitForTimeout(5000);

            const result = await page.evaluate(({ d, m, y }) => {
                const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                const targetMonth = monthNames[m - 1];

                console.log(`🔎 Searching for draw: ${d} ${targetMonth} ${y}`);

                const containers = document.querySelectorAll('div.containerTablero');
                console.log(`Found ${containers.length} potential result boards.`);

                for (const container of containers) {
                    const dateEl = container.querySelector('.date');
                    if (!dateEl) continue;

                    const dateText = dateEl.innerText.trim().toLowerCase();
                    console.log(`Checking board with date info: "${dateText.replace(/\s+/g, ' ')}"`);

                    // Use regex for robust matching (handles newlines, extra spaces, and varies formats)
                    // Matches day as isolated number, and contains month/year
                    const dayRegex = new RegExp(`(^|\\D)${d}(\\D|$)`);
                    if (dayRegex.test(dateText) && dateText.includes(targetMonth) && dateText.includes(y.toString())) {
                        console.log('✅ Found a date match!');
                        const prizes = [];
                        const premioBlocks = container.querySelectorAll('.premio-number');
                        premioBlocks.forEach(el => {
                            const val = el.innerText.trim().replace(/[^0-9]/g, '');
                            if (val) prizes.push(val);
                        });

                        console.log(`📊 Extracted prize numbers: ${prizes.join(', ')}`);
                        if (prizes.length >= 3) {
                            return { time: '3:30 PM', numbers: prizes.slice(0, 3) };
                        }
                    }
                }
                console.log('❌ No matching board found for this date.');
                return null;
            }, { d: day, m: month, y: year });

            if (result) {
                console.log(`✨ [Panama LNB] FOUND: ${result.numbers.join('-')}`);
                const { error } = await supabase
                    .from('lottery_results')
                    .insert([{
                        country: 'Panama',
                        draw_date: dateStr,
                        data: { time: result.time, numbers: result.numbers },
                        external_id: `lnb-pa-${dateStr}`,
                        raw_ocr: `LNB Panama Website Scrape - ${dateStr} (Attempt ${attempt})`
                    }]);

                if (error) console.error('❌ [Panama LNB] Supabase Error:', error.message);
                else {
                    console.log('💾 [Panama LNB] Result saved to Master Supabase.');
                    await browser.close();
                    return; // Successfully found and saved, end scavenger run
                }
            } else {
                console.log(`⚠️ [Panama LNB] Results not published yet or date match failed.`);
            }

        } catch (error) {
            console.error(`❌ [Panama LNB] Scraper Error (Attempt ${attempt}):`, error.message);
        } finally {
            await browser.close();
        }

        if (attempt < MAX_RETRIES) {
            console.log(`😴 [Panama LNB] Waiting ${RETRY_DELAY_MS / 1000} seconds for next try...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }

    console.log(`🛑 [Panama LNB] Reached max retries. Ending hunt for this run.`);
}

module.exports = { scrapePanama };
