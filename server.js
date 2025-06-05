require('dotenv').config();

const PokemonRPA = require('./main');

const PORT = process.env.PORT || 3001;

let pokemonRPA = null;

async function startApplication() {
    try {
        console.log(`Iniciando aplicación en puerto ${PORT}`);
        
        pokemonRPA = new PokemonRPA();
        
        if (pokemonRPA.dashboardServer) {
            pokemonRPA.dashboardServer.port = PORT;
        }
        
        await pokemonRPA.startDashboardMode();
        
        process.stdin.resume();
        
    } catch (error) {
        console.error('Error iniciando aplicación:', error);
        process.exit(1);
    }
}

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
    console.log('Cerrando aplicación...');
    if (pokemonRPA) {
        await pokemonRPA.shutdown();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Interrupción recibida, cerrando...');
    if (pokemonRPA) {
        await pokemonRPA.shutdown();
    }
    process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', async (error) => {
    console.error('Error no capturado:', error);
    if (pokemonRPA) {
        await pokemonRPA.shutdown();
    }
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Promise rechazada:', reason);
    if (pokemonRPA) {
        await pokemonRPA.shutdown();
    }
    process.exit(1);
});

// Iniciar aplicación
startApplication();