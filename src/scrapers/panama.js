const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { DateTime } = require('luxon');
const { supabase } = require('../lib/supabase');

// Add stealth plugin
chromium.use(StealthPlugin());

async function scrapePanama(targetDate = null) {
    const now = targetDate
        ? DateTime.fromISO(targetDate, { zone: 'America/Panama' })
        : DateTime.now().setZone('America/Panama');

    const dateStr = now.toISODate(); // YYYY-MM-DD
    const day = now.day;
    const month = now.month;
    const year = now.year;

    console.log(`🔎 [Panama LNB] Checking results for: ${dateStr}`);

    // HUNT MODE: Check if we already have results for today to stop early
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

    console.log('🚀 [Panama LNB] Results missing. Starting scraper...');

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Simple Stealth and Anti-detection
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        console.log('🌐 [Panama LNB] Navigating to lnb.gob.pa...');
        await page.goto('https://www.lnb.gob.pa/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // Wait for content - LNB site is heavy
        console.log('⏳ [Panama LNB] Waiting for content boxes...');
        await page.waitForTimeout(10000);

        const results = await page.evaluate(({ d, m, y }) => {
            const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const targetMonth = monthNames[m - 1];

            const containers = document.querySelectorAll('div.containerTablero');
            for (const container of containers) {
                const dateEl = container.querySelector('.date');
                if (!dateEl) continue;

                const dateText = dateEl.innerText.trim().toLowerCase();
                // Check if date contains our day, month name and year
                if (dateText.includes(d.toString()) && dateText.includes(targetMonth) && dateText.includes(y.toString())) {
                    const prizes = [];
                    const premioBlocks = container.querySelectorAll('.premio-number');
                    premioBlocks.forEach(el => prizes.push(el.innerText.trim()));

                    if (prizes.length >= 3) {
                        return {
                            time: '3:30 PM',
                            numbers: prizes.slice(0, 3)
                        };
                    }
                }
            }
            return null;
        }, { d: day, m: month, y: year });

        if (results) {
            console.log(`✨ [Panama LNB] FOUND: ${results.numbers.join('-')}`);

            const { error } = await supabase
                .from('lottery_results')
                .insert([{
                    country: 'Panama',
                    draw_date: dateStr,
                    data: {
                        time: results.time,
                        numbers: results.numbers
                    },
                    external_id: `lnb-pa-${dateStr}`,
                    raw_ocr: `LNB Panama Website Scrape - ${dateStr}` // Dummy raw text as it's DOM-based
                }]);

            if (error) console.error('❌ [Panama LNB] Supabase Error:', error.message);
            else console.log('💾 [Panama LNB] Result saved to Master Supabase.');
        } else {
            console.log('⚠️ [Panama LNB] No results found on site yet.');
        }

    } catch (error) {
        console.error('❌ [Panama LNB] Scraper Error:', error.message);
    } finally {
        await browser.close();
    }
}

module.exports = { scrapePanama };
