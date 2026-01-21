const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const OCR_SPACE_KEY = process.env.OCR_SPACE_KEY;

async function performOCR(imageUrl, engine = '2') {
    if (!OCR_SPACE_KEY) {
        throw new Error('OCR_SPACE_KEY is missing in environment variables');
    }

    console.log(`🔍 Performing OCR (Engine ${engine}) on: ${imageUrl}`);

    const form = new FormData();
    form.append('url', imageUrl);
    form.append('apikey', OCR_SPACE_KEY);
    form.append('language', 'spa'); // Spanish
    form.append('isOverlayRequired', 'false');
    form.append('OCREngine', engine); // Engine 2 is usually better, Engine 1 is fallback

    try {
        const response = await axios.post('https://api.ocr.space/parse/image', form, {
            headers: {
                ...form.getHeaders(),
            },
            timeout: 30000
        });

        if (response.data.IsErroredOnProcessing) {
            throw new Error(`OCR.space Error: ${response.data.ErrorMessage.join(', ')}`);
        }

        const parsedText = response.data.ParsedResults?.[0]?.ParsedText || '';
        return parsedText;
    } catch (error) {
        console.error(`❌ Error during OCR.space request (Engine ${engine}):`, error.message);
        throw error;
    }
}

module.exports = { performOCR };
