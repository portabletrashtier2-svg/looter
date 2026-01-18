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

        const blockedTypes = ['image', 'media', 'font', 'stylesheet'];

        if (blockedResources.some(domain => url.includes(domain)) || blockedTypes.includes(resourceType)) {
            // Note: We might need stylesheets for some sites, but LNB is likely fine without them for selector extraction
            // Let's keep stylesheets for now to be safe, but block images/media/fonts
            if (resourceType === 'stylesheet' && !blockedResources.some(domain => url.includes(domain))) {
                return route.continue();
            }
            return route.abort();
        }

        route.continue();
    });
}

module.exports = { enableAdBlocker };
