const { scrapeInstagram } = require('./scrapers/instagram');

async function main() {
    console.log('--- Master Scraper Service ---');

    // For now we just run the Instagram scraper once
    // In production, this would be managed by a cron job (GitHub Actions)
    await scrapeInstagram();

    console.log('--- Finished ---');
}

main().catch(console.error);
