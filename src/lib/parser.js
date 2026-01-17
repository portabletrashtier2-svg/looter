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
        date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
    }

    // Extract numbers (Looking for 2-digit patterns that appear prominently)
    // We only want "isolated" numbers (surrounded by spaces or line breaks)
    // to avoid picking up digits from dates (17-1-2025) or phones (6508-7001)
    const numberRegex = /(?:^|\s)(\d{2})(?=\s|$)/g;
    let match;
    const foundNumbers = [];
    while ((match = numberRegex.exec(text)) !== null) {
        foundNumbers.push(match[1]);
    }

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
