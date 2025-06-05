require('dotenv').config();

const PokemonScraper = require('./src/scraper/pokemonScraper');
const SheetsClient = require('./src/sheets/sheetsClient');
const DataProcessor = require('./src/data/dataProcessor');
const DashboardServer = require('./src/server/dashboardServer');
class PokemonRPA {
    constructor() {
        this.scraper = new PokemonScraper();
        this.sheetsClient = new SheetsClient();
        this.dataProcessor = new DataProcessor();
        this.dashboardServer = new DashboardServer();
        this.startTime = null;
        this.isRunning = false;
    }

    // Helper method para enviar mensajes usando el dashboard server
    async sendMessage(message, type = 'info') {
        if (this.dashboardServer && this.dashboardServer.broadcast) {
            this.dashboardServer.broadcast('scraper_message', { message, type });
        }
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    // Helper method para enviar señal de scraping iniciado
    async sendScrapingStarted() {
        if (this.dashboardServer && this.dashboardServer.broadcast) {
            this.dashboardServer.broadcast('scraping_started', {});
        }
        console.log('[INFO] Scraping started signal sent');
    }

    // Helper method para enviar pokémon extraído
    async sendPokemonExtracted(pokemon) {
        if (this.dashboardServer && this.dashboardServer.handlePokemonExtracted) {
            this.dashboardServer.handlePokemonExtracted(pokemon);
        }
        console.log(`[POKEMON] ${pokemon.name || pokemon.id} extracted`);
    }

    // Helper method para enviar completion
    async sendScraperComplete(total, spreadsheetUrl) {
        if (this.dashboardServer && this.dashboardServer.handleScraperComplete) {
            this.dashboardServer.handleScraperComplete(total, spreadsheetUrl);
        }
        console.log(`[COMPLETE] ${total} Pokémon, URL: ${spreadsheetUrl}`);
    }

    async initialize() {
        this.dashboardServer.start();
        await this.delay(2000);
    }

    async runScraping(targetCount = process.env.SCRAPER_TARGET_COUNT) {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        try {
            this.startTime = Date.now();

            await this.sendMessage('Iniciando scraping de Pokémon...', 'success');

            await this.sendMessage('Inicializando Google Sheets...', 'info');
            await this.sheetsClient.initialize();
            await this.sendMessage('Google Sheets inicializado', 'success');

            await this.sendMessage('Conectando a Pokemon.com...', 'info');

            // Enviar señal de que el scraping real comenzó
            await this.sendScrapingStarted();

            const rawPokemonData = await this.extractWithDashboard(targetCount);

            await this.sendMessage('¡Todos los Pokémon cargados!', 'success');
            await this.sendMessage(`${rawPokemonData.length} Pokémon extraídos correctamente`, 'info');
            await this.sendMessage('Procesando datos extraídos...', 'info');
            const processedData = this.dataProcessor.processData(rawPokemonData);
            await this.sendMessage('Datos procesados correctamente', 'success');

            await this.sendMessage('Subiendo datos a Google Sheets...', 'info');
            await this.sendMessage('Creando spreadsheet...', 'info');
            const result = await this.sheetsClient.uploadData(processedData);

            await this.sendMessage('¡Proceso completado exitosamente!', 'success');
            await this.sendMessage(`Spreadsheet creado: ${result.spreadsheetUrl.substring(0, 50)}...`, 'info');

            const duration = Date.now() - this.startTime;
            await this.sendScraperComplete(processedData.length, result.spreadsheetUrl);

            return {
                success: true,
                pokemonCount: processedData.length,
                duration: duration,
                spreadsheetUrl: result.spreadsheetUrl
            };

        } catch (error) {
            console.error('Error en scraping:', error);
            await this.sendMessage(`Error: ${error.message}`, 'error');
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    async startDashboardMode() {
        try {
            await this.initialize();

            this.dashboardServer.setScrapingHandler((targetCount) => {
                this.runScraping(targetCount);
            });
        } catch (error) {
            console.error('Error iniciando modo dashboard:', error.message);
            throw error;
        }
    }

    async extractWithDashboard(targetCount) {
        // Crear un pseudo-dashboardClient que use nuestros métodos helper
        const pseudoClient = {
            sendMessage: this.sendMessage.bind(this),
            sendPokemonExtracted: this.sendPokemonExtracted.bind(this),
            sendScrapingStarted: this.sendScrapingStarted.bind(this),
            sendScraperComplete: this.sendScraperComplete.bind(this)
        };

        this.scraper.dashboardClient = pseudoClient;
        
        try {
            const pokemonData = await this.scraper.scrapePokemon(targetCount);
            return pokemonData;
        } catch (error) {
            console.error('Error en extracción:', error);
            await this.sendMessage(`Error en extracción: ${error.message}`, 'error');
            throw error;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        if (this.scraper && this.scraper.browserManager) {
            await this.scraper.browserManager.close();
        }
        if (this.dashboardServer) {
            this.dashboardServer.stop();
        }
    }
}

async function main() {
    const rpa = new PokemonRPA();

    process.on('SIGINT', async () => {
        console.log('\n⚠️ Cerrando aplicación...');
        await rpa.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n⚠️ Cerrando aplicación...');
        await rpa.shutdown();
        process.exit(0);
    });

    try {
        await rpa.startDashboardMode();

        // Mantener el proceso activo
        process.stdin.resume();

    } catch (error) {
        console.error('Error:', error);
        await rpa.shutdown();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = PokemonRPA;