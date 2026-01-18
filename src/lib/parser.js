/**
 * Normalizes game names and extracts results from OCR text
 */
function parseLotteryResults(text) {
    console.log('📄 Parsing OCR text:', text);

    const lines = text.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 0);

    let game = null;
    let date = null;
    let numbers = [];

    // 1. Game Identification
    const GAME_MAP = {
        'LA PRIMERA': 'Dominican Republic',
        'LAPRIMERA': 'Dominican Republic',
        'PRIMERA': 'Dominican Republic',
        'LA NICA': 'Nicaragua',
        'LA TICA': 'Costa Rica',
        'LA NEW YORK': 'USA',
        'NEW YORK': 'USA',
        'FLORIDA': 'USA',
        'LA FLORIDA': 'USA',
        'CHIRIQUI TICA': 'Costa Rica',
        'HONDUREÑA': 'Honduras',
        'DIARIA': 'Costa Rica' // Often Used for Tica
    };

    // Priority Check: Find the most specific match first
    for (const [key, value] of Object.entries(GAME_MAP)) {
        if (text.toUpperCase().includes(key)) {
            game = value;
            // If we found a specific country match, we can stop unless it's a multi-country keyword
            if (['Dominican Republic', 'Nicaragua', 'USA', 'Honduras'].includes(value)) break;
        }
    }

    // 2. Date Extraction
    const dateRegex = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
        let day = dateMatch[1].padStart(2, '0');
        let month = dateMatch[2].padStart(2, '0');
        let year = dateMatch[3];

        const currentYear = new Date().getFullYear();
        if (currentYear === 2026 && year === '2025') {
            const currentMonth = new Date().getMonth();
            if (currentMonth <= 1) year = currentYear.toString();
        }
        date = `${year}-${month}-${day}`;
    }

    // 3. Time Extraction
    // Matches formats like "11:00 AM", "6:00 PM", "6 PM", "A LAS 12", etc.
    const timeRegex = /(\d{1,2}(:\d{2})?)\s*(AM|PM)?/i;
    const timeMatch = text.match(timeRegex);
    let rawTime = null;
    if (timeMatch) {
        rawTime = timeMatch[0].trim();
    }

    // 4. Number Extraction (Isolate per Country)
    if (game === 'Costa Rica') {
        numbers = parseCostaRicaNumbers(text, lines);
    } else {
        numbers = parseGenericNumbers(text, lines);
    }

    return { game, date, numbers, rawTime, raw: text };
}

/**
 * Specialized parser for Costa Rica (Tica / Monazos)
 * Uses keyword anchors and handles digit misreads
 */
function parseCostaRicaNumbers(text, lines) {
    const dateLineRegex = /\d{1,2}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{2,4}/;
    const diariaIdx = lines.findIndex(l => l.includes('DIARIA'));
    const ticaIdx = lines.findIndex(l => l.includes('TICA'));
    const monazosIdx = lines.findIndex(l => l.includes('MONAZOS'));

    const primaryAnchorIdx = diariaIdx !== -1 ? diariaIdx : ticaIdx;
    let ticaPrize = null;
    let monazoPrizes = [];

    // 1. Tica Prize (DIARIA)
    if (primaryAnchorIdx !== -1) {
        for (let i = Math.max(0, primaryAnchorIdx - 3); i < lines.length && i < primaryAnchorIdx + 10; i++) {
            const line = lines[i];
            if (dateLineRegex.test(line)) continue;
            const m = line.match(/\b\d{2,3}\b/);
            if (m) {
                const val = m[0];
                ticaPrize = val.length === 3 ? val.slice(-2) : val;
                if (ticaPrize) break;
            }
        }
    }

    // 2. Monazo Prizes (MONAZOS)
    if (monazosIdx !== -1) {
        for (let i = monazosIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (dateLineRegex.test(line)) continue;
            const lineMatches = line.match(/\b\d{2,3}\b/g) || [];
            for (const m of lineMatches) {
                if (monazoPrizes.length < 2) {
                    monazoPrizes.push(m.length === 3 ? m.slice(-2) : m);
                }
            }
            if (monazoPrizes.length >= 2) break;
        }
    }

    return (ticaPrize && monazoPrizes.length === 2) ? [ticaPrize, ...monazoPrizes] : [];
}

/**
 * Generic parser for other countries (Nicaragua, Honduras, USA, etc.)
 * Uses traditional fallback logic: clean text and take last 3 numbers.
 */
function parseGenericNumbers(text, lines) {
    // 1. Clean the text to remove dates and phone numbers
    const cleanText = text
        .replace(/\d{1,2}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{2,4}/g, ' ') // dates
        .replace(/\d{4}\s*[-\s]\s*\d{4}/g, ' ');                     // phones

    // 2. Extract exactly 2-digit numbers
    const allMatches = cleanText.match(/\b\d{2}\b/g) || [];

    // Heuristic: Results are usually the last prominent 2-digit numbers
    if (allMatches.length > 3) {
        return allMatches.slice(-3);
    }
    return allMatches;
}

module.exports = { parseLotteryResults };
