const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

class DashboardServer {
    constructor(port = 3001) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling']
        });

        this.connectedClients = 0;
        this.stats = {
            totalPokemon: 0,
            target: process.env.SCRAPER_TARGET_COUNT,
            status: 'idle'
        };

        // Estado persistente
        this.persistentState = {
            isRunning: false,
            isComplete: false,
            pokemonCount: 0,
            targetCount: process.env.SCRAPER_TARGET_COUNT,
            lastUpdated: null
        };

        this.scrapingHandler = null;

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupMiddleware() {
        this.app.use(cors({ origin: "*" }));
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../')));
        console.log('Middleware configurado')
        this.app.use('/assets', express.static(path.join(process.cwd(), 'assets')));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            const dashboardPath = path.join(__dirname, '../index.html');
            res.sendFile(dashboardPath);
        });

        // Nuevo endpoint para obtener estado persistente
        this.app.get('/api/state', (req, res) => {
            res.json(this.persistentState);
        });

        this.app.get('/api/stats', (req, res) => {
            res.json(this.stats);
        });

        this.app.post('/api/scraper/start', (req, res) => {
            const { target } = req.body;

            // Actualizar estado persistente
            this.persistentState = {
                isRunning: true,
                isComplete: false,
                pokemonCount: 0,
                targetCount: target || process.env.SCRAPER_TARGET_COUNT,
                lastUpdated: new Date().toISOString()
            };

            // Ejecutar el handler si está configurado
            if (this.scrapingHandler) {
                this.scrapingHandler(target || process.env.SCRAPER_TARGET_COUNT);
            }

            this.handleScraperStart(target || process.env.SCRAPER_TARGET_COUNT);
            res.json({
                success: true,
                message: 'Scraper iniciado exitosamente',
                target: target || process.env.SCRAPER_TARGET_COUNT
            });
        });

        this.app.post('/api/scraper/message', (req, res) => {
            const { message, type } = req.body;
            this.broadcast('scraper_message', { message, type: type || 'info' });
            res.json({ message: 'Message sent' });
        });

        this.app.post('/api/scraper/scraping-started', (req, res) => {
            this.handleScrapingStarted();
            res.json({ message: 'Scraping started signal sent' });
        });

        this.app.post('/api/scraper/pokemon', (req, res) => {
            const pokemon = req.body;
            // Actualizar estado persistente
            this.persistentState.pokemonCount++;
            this.persistentState.lastUpdated = new Date().toISOString();

            this.handlePokemonExtracted(pokemon);
            res.json({ message: 'Pokemon data received' });
        });

        this.app.post('/api/scraper/error', (req, res) => {
            const { error, context } = req.body;
            res.json({ message: 'Error registered' });
        });

        this.app.post('/api/scraper/complete', (req, res) => {
            const { total, spreadsheetUrl } = req.body;

            // Actualizar estado persistente como completado
            this.persistentState = {
                isRunning: false,
                isComplete: true,
                pokemonCount: total,
                targetCount: this.persistentState.targetCount,
                lastUpdated: new Date().toISOString(),
                spreadsheetUrl: spreadsheetUrl
            };

            this.handleScraperComplete(total, spreadsheetUrl);
            res.json({ message: 'Scraper completion registered' });
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            this.connectedClients++;

            socket.emit('stats_update', this.stats);

            socket.on('request_stats', () => {
                socket.emit('stats_update', this.stats);
            });

            socket.on('disconnect', () => {
                this.connectedClients--;
            });
        });
    }

    handleScraperStart(target) {
        this.stats = {
            totalPokemon: 0,
            target: target,
            status: 'running'
        };

        this.broadcast('stats_update', this.stats);
    }

    handlePokemonExtracted(pokemon) {
        this.stats.totalPokemon++;
        this.broadcast('stats_update', this.stats);
    }

    handleScraperComplete(total, spreadsheetUrl) {
        this.stats.status = 'completed';
        this.stats.totalPokemon = total;
        this.stats.spreadsheetUrl = spreadsheetUrl;

        this.broadcast('stats_update', this.stats);
    }

    handleScrapingStarted() {
        this.broadcast('scraping_started', {
            timestamp: Date.now()
        });
    }

    broadcast(event, data) {
        this.io.emit(event, data);
    }

    setScrapingHandler(handler) {
        this.scrapingHandler = handler;
        console.log('Handler de scraping configurado');
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`
            ::::::::::::::::-:::::::::::::::::::::::::::::
            ::::::::::::=++====-:::::=+*##*+=:::::::::::::
            ::::::::::=#%*=====-:::*#%%%%%%%%#*-::::::::::
            :::::::::=%%%#*+==-::-#%%%%%%%%%%%%#=:::::::::
            ::::::::-%%%%#+::::::*%%%%#+-:-+#%%%#-::::::::
            ::::::::*%%%%+::::::=%%%%#=:::::=%%%%#::::::::
            ::::::::#%%%%:::::::*%%%%#:::::::%%%%%::::::::
            ::::::::#%%%%-::::::#%%%%*::::::-%%%%#::::::::
            ::::::::+%%%%*:::::+#%%%#-:::::-#%%%%+::::::::
            :::::::::#%%%%##*##%%%%%+:::=++*#%%%*:::::::::
            ::::::::::*#%%%%%%%%%%#*:::++++++%#+::::::::::
            :::::::::::=*#%%%%%%#*-::::=++++++::::::::::::
            ::::::::::::::-====-::::::::---:::::::::::::::
            `)
            console.log('Prueba Técnica Juan Garcia')
            console.log('=================================');
            console.log(`http://localhost:${this.port}`);
            console.log('=================================');
        });
    }

    stop() {
        this.server.close();
    }
}

module.exports = DashboardServer;