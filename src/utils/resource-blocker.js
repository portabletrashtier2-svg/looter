/**
 * Utility to block non-essential resources to speed up scraping
 */
async function enableAdBlocker(page) {
    await page.route('**/*', (route) => {
        const url = route.request().url().toLowerCase();
        const resourceType = route.request().resourceType();

        // Block common ad/tracking domains and non-essential resources
        const blockedResources = [
            'google-analytics.com',
            'googletagmanager.com',
            'facebook.net',
            'doubleclick.net',
            'amazon-adsystem.com',
            'adnxs.com',
            'maps.googleapis.com', // Maps are heavy and slow
            'fonts.googleapis.com',
            'fonts.gstatic.com'
        ];

        const blockedTypes = ['image', 'media'];

        if (blockedResources.some(domain => url.includes(domain)) || blockedTypes.includes(resourceType)) {
            return route.abort();
        }

        route.continue();
    });
}

module.exports = { enableAdBlocker };
