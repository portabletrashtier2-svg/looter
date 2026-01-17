const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const OCR_SPACE_KEY = process.env.OCR_SPACE_KEY;

async function performOCR(imageUrl) {
    if (!OCR_SPACE_KEY) {
        throw new Error('OCR_SPACE_KEY is missing in environment variables');
    }

    console.log(`🔍 Performing OCR on: ${imageUrl}`);

    const form = new FormData();
    form.append('url', imageUrl);
    form.append('apikey', OCR_SPACE_KEY);
    form.append('language', 'spa'); // Spanish
    form.append('isOverlayRequired', 'false');
    form.append('OCREngine', '2'); // Engine 2 is better for stylized text/backgrounds

    try {
        const response = await axios.post('https://api.ocr.space/parse/image', form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        if (response.data.IsErroredOnProcessing) {
            throw new Error(`OCR.space Error: ${response.data.ErrorMessage.join(', ')}`);
        }

        const parsedText = response.data.ParsedResults?.[0]?.ParsedText || '';
        return parsedText;
    } catch (error) {
        console.error('❌ Error during OCR.space request:', error.message);
        throw error;
    }
}

module.exports = { performOCR };
