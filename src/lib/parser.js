/**
 * Normalizes game names and extracts results from OCR text
 */
function parseLotteryResults(text) {
    console.log('📄 Parsing OCR text:', text);

    const lines = text.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 0);

    let game = null;
    let date = null;
    let numbers = [];

    // Game Mapping
    const GAME_MAP = {
        'LA TICA': 'tica',
        'CHIRIQUI TICA': 'tica',
        'LA NICA': 'nica',
        'LA NEW YORK': 'ny',
        'NEW YORK': 'ny',
        'FLORIDA': 'fl',
        'LA FLORIDA': 'fl'
    };

    // Try to find game
    for (const [key, value] of Object.entries(GAME_MAP)) {
        if (text.toUpperCase().includes(key)) {
            game = value;
            break;
        }
    }

    // Try to find date (DD-MM-YYYY or DD/MM/YYYY)
    const dateRegex = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
        date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
    }

    // Extract numbers (Looking for 2-digit patterns that appear prominently)
    // We look for 2-digit numbers that are either isolated by spaces or at the end of lines
    const numberRegex = /(?:^|\s)(\d{2})(?:\s|$)/g;
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
