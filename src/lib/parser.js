/**
 * Normalizes game names and extracts results from OCR text
 */
function parseLotteryResults(text) {
    console.log('📄 Parsing OCR text:', text);

    const lines = text.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 0);

    let game = null;
    let date = null;
    let numbers = [];

    // Game Mapping (Ordered by priority/specificity)
    const GAME_MAP = {
        'LA NICA': 'nica',
        'LA TICA': 'tica',
        'LA NEW YORK': 'ny',
        'NEW YORK': 'ny',
        'FLORIDA': 'fl',
        'LA FLORIDA': 'fl',
        'CHIRIQUI TICA': 'tica',
        'HONDUREÑA': 'nica',
        'DIARIA': 'tica' // Often Used for Tica
    };

    // Try to find game
    for (const [key, value] of Object.entries(GAME_MAP)) {
        if (text.toUpperCase().includes(key)) {
            // Special check: If we found a generic match like CHIRIQUI TICA, 
            // but the text ALSO has something more specific like LA NICA, 
            // priority should go to the more specific one.
            // Our map order helps, but we can also check for actual core game names.
            game = value;

            // If it's a "Real" game name (not the profile name), we can stop
            if (!key.includes('CHIRIQUI')) break;
        }
    }

    // Try to find date (DD-MM-YYYY or DD/MM/YYYY)
    const dateRegex = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
        let day = dateMatch[1].padStart(2, '0');
        let month = dateMatch[2].padStart(2, '0');
        let year = dateMatch[3];

        // Smart Correction: Handle "Happy New Year" typos
        // If it's currently 2026 and the card says 2025 during January/February, 
        // it's 99% a typo on the Instagram card.
        const currentYear = new Date().getFullYear();
        if (currentYear === 2026 && year === '2025') {
            const currentMonth = new Date().getMonth(); // 0 = Jan
            if (currentMonth <= 1) { // Jan or Feb
                console.log(`🪄 Auto-correcting year from ${year} to ${currentYear} (New Year typo detected)`);
                year = currentYear.toString();
            }
        }

        date = `${year}-${month}-${day}`;
    }

    // Extract numbers (Looking for 2-digit patterns that appear prominently)
    // 1. Clean the text to remove dates and phone numbers that often contain 2-digit pairs
    // We use a more robust regex that handles optional spaces
    const cleanText = text
        .replace(/\d{1,2}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{2,4}/g, ' ') // dates: 17-1-2025
        .replace(/\d{4}\s*[-\s]\s*\d{4}/g, ' ');                     // phones: 6508-7001

    // 2. Extract all digit sequences and filter for exactly 2 digits
    // This is safer than complex regex with lookarounds
    const allMatches = cleanText.match(/\d+/g) || [];
    const foundNumbers = allMatches.filter(n => n.length === 2);

    console.log('🔢 Found 2-digit sequences:', foundNumbers);

    // Heuristic: For this specific Instagram layout, the lottery results 
    // are ALWAYS the last 3 prominent 2-digit numbers at the bottom.
    numbers = foundNumbers.slice(-3);

    return {
        game,
        date,
        numbers,
        raw: text
    };
}

module.exports = { parseLotteryResults };
