const { scrapePanama } = require('./scrapers/panama');

async function main() {
    console.log('--- Panama LNB Dedicated Scraper ---');
    await scrapePanama();
    console.log('--- Finished ---');
}

main().catch(console.error);
