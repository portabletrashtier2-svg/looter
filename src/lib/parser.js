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
    // We use lookarounds to avoid consuming the separator (whitespace/newline)
    // and missing adjacent numbers (e.g., "99\n59\n16")
    const numberRegex = /(?<!\d)(\d{2})(?!\d)/g;
    let match;
    const foundNumbers = [];
    while ((match = numberRegex.exec(text)) !== null) {
        foundNumbers.push(match[1]);
    }

    // Heuristic: Usually lottery results are the first 1-3 prominent 2-digit numbers
    // In the Instagram layout, they are often on separate lines or clearly spaced
    numbers = foundNumbers.slice(0, 3);

    return {
        game,
        date,
        numbers,
        raw: text
    };
}

module.exports = { parseLotteryResults };
