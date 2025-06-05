require('dotenv').config();

const config = {
    google: {
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
        privateKey: process.env.GOOGLE_PRIVATE_KEY ? 
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
        projectId: process.env.GOOGLE_PROJECT_ID
    }
};

module.exports = config;