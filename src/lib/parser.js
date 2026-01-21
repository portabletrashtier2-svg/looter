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
        'HONDURAS': 'Honduras',
        'LOTO': 'Honduras',
        'DIARIA': 'Costa Rica' // Fallback for Tica, but Honduras check happens first
    };

    // Priority Check: Find the most specific match first
    for (const [key, value] of Object.entries(GAME_MAP)) {
        if (text.toUpperCase().includes(key)) {
            game = value;
            // If we found a specific country match, we can stop unless it's a multi-country keyword
            if (['Honduras', 'Dominican Republic', 'Nicaragua', 'USA'].includes(value)) break;
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
    } else if (game === 'Honduras') {
        numbers = parseHondurasNumbers(text, lines);
    } else {
        numbers = parseGenericNumbers(text, lines);
    }

    return { game, date, numbers, rawTime, raw: text };
}

/**
 * Specialized parser for Honduras (Diaria / Premiados)
 */
function parseHondurasNumbers(text, lines) {
    let results = [];
    console.log(`[Parser] Specialized Honduras start. Total lines: ${lines.length}`);

    // Clean text for better extraction (remove common junk)
    const cleanedLines = lines.map(line =>
        line.replace(/\d{4}\s*[-\s]\s*\d{4}/g, ' ') // phone numbers
            .replace(/\d{1,2}(?::\d{2})?\s*(?:AM|PM)/gi, ' ') // times
            .replace(/\d{1,2}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{2,4}/g, ' ') // dates
    );

    // 1. Find DIARIA keyword
    const diariaIdx = lines.findIndex(l => l.includes('DIARIA') || l.includes('DIAR') || l.includes('DIAR1A') || l.includes('D1AR'));

    if (diariaIdx !== -1) {
        console.log(`[Parser] DIARIA found at line ${diariaIdx}: "${lines[diariaIdx]}"`);

        // 2. Collect all valid 2-digit numbers after DIARIA
        // Looking ahead up to 15 lines
        for (let i = diariaIdx; i < diariaIdx + 15 && i < cleanedLines.length; i++) {
            const line = cleanedLines[i];

            // Skip extremely long lines (ads/info) or lines with too many numbers
            if (line.length > 30) continue;

            const matches = line.match(/\b\d{2}\b/g) || [];
            for (const m of matches) {
                // Heuristic: Avoid duplicates and known years
                if (!results.includes(m) && m !== '20' && m !== '26' && m !== '25') {
                    results.push(m);
                    console.log(`[Parser]   Found result candidate: ${m} at line ${i}`);
                }
            }
            if (results.length >= 3) break;
        }
    }

    // Fallback if specialized parsing failed to get 3 numbers
    if (results.length < 3) {
        console.log(`⚠️ Honduras specialized parsing incomplete (${results.length} found: ${results.join('-')}), falling back to generic.`);
        const generic = parseGenericNumbers(text, lines);

        if (results.length === 0) return generic;

        // Try to fill the gaps from generic but avoid duplicates
        for (const n of generic) {
            if (results.length < 3 && !results.includes(n)) {
                results.push(n);
            }
        }
    }

    return results;
}

/**
 * Specialized parser for Costa Rica (Tica / Monazos)
 * Uses keyword anchors and handles digit misreads
 */
function parseCostaRicaNumbers(text, lines) {
    const dateLineRegex = /\d{1,2}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{2,4}/;
    const monazosIdx = lines.findIndex(l => l.includes('MONAZOS'));

    let results = [];

    // 1. Prioritize MONAZOS block (this Instagram profile labels Monazos as [Tica, Pair1, Pair2])
    if (monazosIdx !== -1) {
        for (let i = monazosIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (dateLineRegex.test(line)) continue;

            // Extract all 2-digit numbers
            const lineMatches = line.match(/\b\d{2}\b/g) || [];
            for (const m of lineMatches) {
                if (results.length < 3) {
                    results.push(m);
                }
            }
            if (results.length >= 3) break;
        }
    }

    // 2. Fallback to DIARIA or general extraction if Monazos didn't provide enough
    if (results.length < 3) {
        const diariaIdx = lines.findIndex(l => l.includes('DIARIA'));
        const ticaIdx = lines.findIndex(l => l.includes('TICA'));
        const primaryAnchorIdx = diariaIdx !== -1 ? diariaIdx : ticaIdx;

        if (primaryAnchorIdx !== -1) {
            for (let i = Math.max(0, primaryAnchorIdx - 3); i < lines.length && i < primaryAnchorIdx + 10; i++) {
                const line = lines[i];
                if (dateLineRegex.test(line)) continue;
                const m = line.match(/\b\d{2}\b/);
                if (m && !results.includes(m[0])) {
                    results.unshift(m[0]); // Add Tica to the front
                    break;
                }
            }
        }

        // Final fallback: take whatever pairs we found in the whole text
        if (results.length < 3) {
            const allMatches = text.match(/\b\d{2}\b/g) || [];
            for (const m of allMatches) {
                if (!results.includes(m) && results.length < 3) {
                    results.push(m);
                }
            }
        }
    }

    return results.slice(0, 3);
}

/**
 * Generic parser for other countries (Nicaragua, Honduras, USA, etc.)
 * Uses traditional fallback logic: clean text and take last 3 numbers.
 */
function parseGenericNumbers(text, lines) {
    // 1. Clean the text to remove dates, phone numbers, and potential hour/PM matches
    const cleanText = text
        .replace(/\d{1,2}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{2,4}/g, ' ') // dates
        .replace(/\d{4}\s*[-\s]\s*\d{4}/g, ' ')                     // phones
        .replace(/\d{1,2}(?::\d{2})?\s*(?:AM|PM)/gi, ' ');           // times (12PM, etc)

    // 2. Extract exactly 2-digit numbers
    const allMatches = cleanText.match(/\b\d{2}\b/g) || [];

    // 3. Filter out common false positives (like 2026, etc.)
    const results = allMatches.filter(m => {
        const val = parseInt(m);
        // Avoid parts of years (20, 26, 25)
        if (val === 20 || val === 26 || val === 25) return false;
        return true;
    });

    // Heuristic: Results are usually the last prominent 2-digit numbers
    if (results.length > 3) {
        return results.slice(-3);
    }
    return results;
}

module.exports = { parseLotteryResults };
