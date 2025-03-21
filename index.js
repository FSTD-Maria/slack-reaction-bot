const { google } = require('googleapis');
const fs = require('fs');

const auth = new google.auth.GoogleAuth({
  keyFile: '/etc/secrets/service_account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function appendToSheet(data) {
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.YOUR_SHEET_ID,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [data],
    },
  });

  console.log('Sheet updated:', response.data);
}
