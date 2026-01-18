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
    // Values match DRAW_NAME_MAPPING keys in the main app
    const GAME_MAP = {
        'LA NICA': 'Nicaragua',
        'LA TICA': 'Costa Rica',
        'LA NEW YORK': 'USA',
        'NEW YORK': 'USA',
        'FLORIDA': 'USA',
        'LA FLORIDA': 'USA',
        'CHIRIQUI TICA': 'Costa Rica',
        'HONDUREÑA': 'Honduras',
        'LA PRIMERA': 'Dominican Republic',
        'DIARIA': 'Costa Rica' // Often Used for Tica
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

    // Try to find time (Looking for HH:MM AM/PM or HH:MM)
    const timeRegex = /(\d{1,2}:\d{2})\s*(AM|PM)?/i;
    const timeMatch = text.match(timeRegex);
    let rawTime = null;
    if (timeMatch) {
        rawTime = timeMatch[0].trim();
    }

    // Extract numbers (Looking for 2-digit patterns that appear prominently)
    if (game === 'Costa Rica') {
        const diariaIdx = lines.findIndex(l => l.includes('DIARIA') || l.includes('TICA'));
        const monazosIdx = lines.findIndex(l => l.includes('MONAZOS'));

        let ticaPrize = null;
        let monazoPrizes = [];

        // 1. Find Tica prize after "DIARIA" or "TICA"
        if (diariaIdx !== -1) {
            for (let i = diariaIdx + 1; i < lines.length && i < diariaIdx + 10; i++) {
                // Ignore lines that look like draw numbers (e.g., 101, 102)
                const m = lines[i].match(/\b\d{2}\b/);
                if (m && !lines[i].match(/^\d{3,}$/)) {
                    ticaPrize = m[0];
                    break;
                }
            }
        }

        // 2. Find Monazo prizes after "MONAZOS"
        if (monazosIdx !== -1) {
            for (let i = monazosIdx + 1; i < lines.length; i++) {
                const lineMatches = lines[i].match(/\d+/g) || [];
                for (const m of lineMatches) {
                    if (m.length === 2 && monazoPrizes.length < 2) {
                        monazoPrizes.push(m);
                    }
                }
                if (monazoPrizes.length >= 2) break;
            }
        }

        if (ticaPrize && monazoPrizes.length === 2) {
            numbers = [ticaPrize, ...monazoPrizes];
        }
    }

    // Fallback: Generic extraction if specialized logic failed or for other games
    if (numbers.length === 0) {
        // 1. Clean the text to remove dates and phone numbers
        const cleanText = text
            .replace(/\d{1,2}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{2,4}/g, ' ') // dates
            .replace(/\d{4}\s*[-\s]\s*\d{4}/g, ' ');                     // phones

        // 2. Extract all digit sequences and filter for exactly 2 digits
        // Improved: match only 2-digit numbers NOT part of larger numbers
        const allMatches = cleanText.match(/\b\d{2}\b/g) || [];

        // Remove common draw numbers (heuristic: usually at the beginning)
        // If we have more than 3 numbers, the ones after the draw number are likely the results
        if (allMatches.length > 3) {
            numbers = allMatches.slice(-3);
        } else {
            numbers = allMatches;
        }
    }

    return {
        game,
        date,
        numbers,
        rawTime,
        raw: text
    };
}

module.exports = { parseLotteryResults };
