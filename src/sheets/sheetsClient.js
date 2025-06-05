const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('../config/config');

class SheetsClient {
    constructor() {
        this.doc = null;
        this.sheet = null;
        this.isInitialized = false;
    }

    async initialize() {        
        const serviceAccountAuth = new JWT({
            email: config.google.clientEmail,
            key: config.google.privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        this.doc = new GoogleSpreadsheet(config.google.spreadsheetId, serviceAccountAuth);
        await this.doc.loadInfo();
        
        await this.setupWorksheet();
        this.isInitialized = true;
    }

    async setupWorksheet() {
        const worksheetTitle = 'Pokemon Data';
        this.sheet = this.doc.sheetsByTitle[worksheetTitle];
        
        if (!this.sheet) {
            this.sheet = await this.doc.addSheet({ title: worksheetTitle });
        } else {
            console.log('Hoja ya creada!');
        }

        await this.setupHeaders();
    }

    async setupHeaders() {
        const headers = [
            'No. Pokédex',
            'Nombre',
            'Descripción',
            'Tipo',
            'URL',
            'Fecha de Actualización'
        ];

        await this.sheet.loadCells('A1:F1');
        const firstCell = this.sheet.getCell(0, 0);
        
        if (!firstCell.value) {
            await this.sheet.setHeaderRow(headers);
        }
    }

    async uploadData(pokemonData) {
        
        await this.clearExistingData();
        
        const rows = pokemonData.map(pokemon => ({
            'No. Pokédex': pokemon.number,
            'Nombre': pokemon.name,
            'Descripción': pokemon.description,
            'Tipo': pokemon.types,
            'URL': pokemon.imageUrl,
            'Fecha de Actualización': new Date().toISOString().split('T')[0]
        }));

        const batchSize = 50;
        let uploadedCount = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            await this.sheet.addRows(batch);
            uploadedCount += batch.length;
            await this.delay(1000);
        }
        
        return {
            success: true,
            uploadedCount: uploadedCount,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${config.google.spreadsheetId}`
        };
    }

    async clearExistingData() {
        const rows = await this.sheet.getRows();
        
        if (rows.length > 0) {
            for (const row of rows) {
                await row.delete();
            }
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = SheetsClient;