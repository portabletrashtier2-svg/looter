const { scrapeFlorida } = require('./scrapers/florida');

async function main() {
    console.log('--- Florida Noche Dedicated Scraper ---');
    await scrapeFlorida();
    console.log('--- Finished ---');
}

main().catch(console.error);
