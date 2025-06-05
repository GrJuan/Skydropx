require('dotenv').config();
const BrowserManager = require('./browserManager');

class PokemonScraper {
    constructor() {
        this.browserManager = new BrowserManager();
        this.baseUrl = 'https://www.pokemon.com/el/pokedex';
        this.pokemonData = [];
    }

    async scrapePokemon(targetCount = process.env.SCRAPER_TARGET_COUNT) {
        const { browser, page } = await this.browserManager.initialize();

        try {
            if (this.dashboardClient) {
                await this.dashboardClient.sendMessage('Inicializando navegador...', 'info');
            }
            if (this.dashboardClient) {
                await this.dashboardClient.sendMessage('Visitando Pokemon.com...', 'info');
            }

            await page.goto('https://www.pokemon.com/', {
                waitUntil: 'networkidle0',
                timeout: 60000
            });

            await this.browserManager.humanDelay(3000, 6000);
            await this.browserManager.humanScroll(page);

            if (this.dashboardClient) {
                await this.dashboardClient.sendMessage('Cambiando idioma a español...', 'info');
            }
            try {
                const langSelector = await page.$('a[href*="/el/"]') || await page.$('[data-lang="es"]');
                if (langSelector) {
                    await langSelector.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
                } else {
                    await page.goto('https://www.pokemon.com/el/', {
                        waitUntil: 'networkidle0',
                        timeout: 60000
                    });
                }
            } catch (langError) {
                await page.goto('https://www.pokemon.com/el/', {
                    waitUntil: 'networkidle0',
                    timeout: 60000
                });
            }

            if (this.dashboardClient) {
                await this.dashboardClient.sendMessage('Navegando a la Pokédx...', 'info');
            }
            try {
                const pokedexLink = await page.$('a[href*="pokedex"]');
                if (pokedexLink) {
                    await pokedexLink.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
                } else {
                    await page.goto(this.baseUrl, {
                        waitUntil: 'networkidle0',
                        timeout: 60000
                    });
                }
            } catch (navError) {
                await page.goto(this.baseUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 60000
                });
            }

            await this.browserManager.humanDelay(3000, 6000);

            const pageTitle = await page.title();
            if (pageTitle.includes('403') || pageTitle.includes('Error') || pageTitle.includes('Blocked')) {
                return await this.getFallbackPokemonData(targetCount);
            }

            const possibleSelectors = [
                '#loadMore',
                '.button-lightblue',
                '.pokemon-list',
                '.pokedex-results',
                '.pokemon-grid'
            ];

            try {
                await this.browserManager.waitForAnySelector(possibleSelectors, 45000);
            } catch (selectorError) {
                return this.getFallbackPokemonData(targetCount);
            }

            await this.loadAllPokemon(page, targetCount);
            const pokemonList = await this.extractPokemonList(page, targetCount);

            for (let i = 0; i < pokemonList.length && i < targetCount; i++) {
                const pokemon = pokemonList[i];

                const detailedData = await this.extractPokemonDetails(page, pokemon);
                this.pokemonData.push(detailedData);

                await this.browserManager.humanDelay(1000, 2000);
            }

            return this.pokemonData;

        } catch (error) {
            return this.getFallbackPokemonData(targetCount);
        }
    }

    async loadAllPokemon(page, targetCount) {
        if (this.dashboardClient) {
            await this.dashboardClient.sendMessage('Cargando lista de Pokémon...', 'info');
        }

        if (this.dashboardClient) {
            await this.dashboardClient.sendMessage('Iniciando conteo de Pokémon...', 'success');
            await this.dashboardClient.sendScrapingStarted();
        }

        let loadedCount = 0;
        let attempts = 0;
        const maxAttempts = 30;

        while (loadedCount < targetCount && attempts < maxAttempts) {
            const currentCount = await page.evaluate(() => {
                return document.querySelectorAll('.pokedex-results .results li').length;
            });

            if (this.dashboardClient && currentCount > 0) {
                await this.dashboardClient.sendMessage(`Pokémon cargados: ${currentCount}/${targetCount}`, 'info');
            }

            if (currentCount >= targetCount) {
                if (this.dashboardClient) {
                    await this.dashboardClient.sendMessage(`¡Carga completa! ${currentCount}/${targetCount} Pokémon`, 'success');
                    await this.dashboardClient.sendMessage('Extracción de Pokémon finalizada', 'success');
                }
                break;
            }
            try {
                const loadMoreButton = await page.$('#loadMore .button-lightblue') ||
                    await page.$('#loadMore') ||
                    await page.$('.button-lightblue');

                if (loadMoreButton) {
                    const isVisible = await page.evaluate(button => {
                        const rect = button.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0;
                    }, loadMoreButton);

                    if (isVisible) {
                        await loadMoreButton.scrollIntoView();
                        await this.browserManager.humanDelay(500, 1000);
                        await loadMoreButton.click();
                        await this.browserManager.humanDelay(3000, 5000);
                    } else {
                        break;
                    }
                } else {
                    break;
                }

            } catch (buttonError) {
                attempts++;
                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                });
                await this.browserManager.humanDelay(1000, 2000);
                continue;
            }

            const newCount = await page.evaluate(() => {
                return document.querySelectorAll('.pokedex-results .results li').length;
            });

            if (newCount === loadedCount) {
                attempts++;
                if (attempts >= 5) break;
            } else {
                attempts = 0;
            }

            loadedCount = newCount;
        }

        return loadedCount;
    }

    async extractPokemonList(page, targetCount) {
        const pokemonList = await page.evaluate((limit) => {
            const pokemonElements = document.querySelectorAll('.pokedx-results .results li');

            if (pokemonElements.length === 0) {
                const alternativeSelectors = [
                    'ul.results li',
                    '.results li',
                    'section.pokedx-results li'
                ];

                for (let selector of alternativeSelectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        return Array.from(elements).slice(0, limit).map((element, index) => {
                            const link = element.querySelector('a');
                            const img = element.querySelector('img');
                            const numberElement = element.querySelector('.pokemon-info .id');
                            const nameElement = element.querySelector('.pokemon-info h5');
                            const typeElements = element.querySelectorAll('.pokemon-info .abilities .pill');

                            let number = '';
                            if (numberElement) {
                                const match = numberElement.textContent.match(/(\d+)/);
                                number = match ? `#${match[1]}` : '';
                            }

                            const types = Array.from(typeElements).map(pill => pill.textContent.trim());

                            return {
                                name: nameElement ? nameElement.textContent.trim() : '',
                                number: number,
                                imageUrl: img ? img.src : '',
                                detailUrl: link ? link.href : '',
                                types: types.join('/')
                            };
                        });
                    }
                }
                return [];
            }

            return Array.from(pokemonElements).slice(0, limit).map((element, index) => {
                const link = element.querySelector('a');
                const img = element.querySelector('img');
                const numberElement = element.querySelector('.pokemon-info .id');
                const nameElement = element.querySelector('.pokemon-info h5');
                const typeElements = element.querySelectorAll('.pokemon-info .abilities .pill');

                let number = '';
                if (numberElement) {
                    const match = numberElement.textContent.match(/(\d+)/);
                    number = match ? `#${match[1]}` : '';
                }

                const types = Array.from(typeElements).map(pill => pill.textContent.trim());

                return {
                    name: nameElement ? nameElement.textContent.trim() : '',
                    number: number,
                    imageUrl: img ? img.src : '',
                    detailUrl: link ? link.href : '',
                    types: types.join('/')
                };
            });
        }, targetCount);

        const validPokemon = pokemonList.filter(pokemon => pokemon.name && pokemon.number);
        return validPokemon;
    }

    async extractPokemonDetails(page, basicData) {
        try {
            let pokemonData;

            if (basicData.detailUrl) {
                await page.goto(basicData.detailUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                await this.browserManager.humanDelay(1000, 2000);

                const detailData = await page.evaluate(() => {
                    const descriptionSelectors = [
                        '.version-descriptions.active p.version-x.active'
                    ];

                    let description = '';
                    for (let selector of descriptionSelectors) {
                        const element = document.querySelector(selector);
                        if (element && element.textContent.trim()) {
                            description = element.textContent.trim();
                            break;
                        }
                    }

                    return { description };
                });

                pokemonData = {
                    number: this.cleanPokemonNumber(basicData.number),
                    name: basicData.name,
                    description: detailData.description || `Descripción de ${basicData.name} no disponible.`,
                    types: basicData.types || 'Desconocido',
                    imageUrl: basicData.imageUrl
                };
            } else {
                pokemonData = {
                    number: this.cleanPokemonNumber(basicData.number),
                    name: basicData.name,
                    description: `${basicData.name} es un Pokémon de tipo ${basicData.types || 'desconocido'}.`,
                    types: basicData.types || 'Desconocido',
                    imageUrl: basicData.imageUrl
                };
            }

            if (this.dashboardClient) {
                try {
                    await this.dashboardClient.sendPokemonExtracted(pokemonData);
                } catch (dashError) {
                    console.warn(`Error enviando ${pokemonData.name} al dashboard:`, dashError.message);
                }
            }

            return pokemonData;

        } catch (error) {
            console.warn(`Error extrayendo detalles de ${basicData.name}:`, error.message);

            const fallbackData = {
                number: this.cleanPokemonNumber(basicData.number),
                name: basicData.name,
                description: `Información detallada de ${basicData.name} no disponible.`,
                types: basicData.types || 'Desconocido',
                imageUrl: basicData.imageUrl
            };

            if (this.dashboardClient) {
                try {
                    await this.dashboardClient.sendPokemonExtracted(fallbackData);
                } catch (dashError) {
                    console.warn(`Error enviando fallback al dashboard:`, dashError.message);
                }
            }

            return fallbackData;
        }
    }

    async getFallbackPokemonData(targetCount) {
        const pokemonData = [];

        try {
            for (let i = 1; i <= Math.min(targetCount, process.env.SCRAPER_TARGET_COUNT); i++) {
                try {
                    const pokemonResponse = await this.makeAPIRequest(`https://pokeapi.co/api/v2/pokemon/${i}`);
                    const speciesResponse = await this.makeAPIRequest(`https://pokeapi.co/api/v2/pokemon-species/${i}`);

                    const types = pokemonResponse.types
                        .map(typeInfo => typeInfo.type.name)
                        .join('/');

                    let description = 'Descripción no disponible';
                    if (speciesResponse.flavor_text_entries) {
                        const spanishEntry = speciesResponse.flavor_text_entries.find(
                            entry => entry.language.name === 'es'
                        );
                        if (spanishEntry) {
                            description = spanishEntry.flavor_text
                                .replace(/\n/g, ' ')
                                .replace(/\f/g, ' ')
                                .trim();
                        }
                    }

                    const imageUrl = pokemonResponse.sprites.other?.['official-artwork']?.front_default ||
                        pokemonResponse.sprites.front_default ||
                        `https://assets.pokemon.com/assets/cms2/img/pokedx/detail/${i.toString().padStart(3, '0')}.png`;

                    pokemonData.push({
                        number: pokemonResponse.id,
                        name: this.capitalizeName(pokemonResponse.name),
                        description: description,
                        types: types,
                        imageUrl: imageUrl
                    });

                    await this.delay(100);

                } catch (apiError) {
                    console.warn(`Error obteniendo Pokémon #${i}:`, apiError.message);

                    pokemonData.push({
                        number: i,
                        name: `Pokémon #${i}`,
                        description: `Datos del Pokémon número ${i} no disponibles.`,
                        types: 'Desconocido',
                        imageUrl: `https://assets.pokemon.com/assets/cms2/img/pokedx/detail/${i.toString().padStart(3, '0')}.png`
                    });
                }
            }

        } catch (error) {
            for (let i = 1; i <= targetCount; i++) {
                pokemonData.push({
                    number: i,
                    name: `Pokémon #${i}`,
                    description: `Información del Pokémon número ${i} no disponible.`,
                    types: 'Desconocido',
                    imageUrl: `https://assets.pokemon.com/assets/cms2/img/pokedx/detail/${i.toString().padStart(3, '0')}.png`
                });
            }
        }

        return pokemonData;
    }

    makeAPIRequest(url) {
        return new Promise((resolve, reject) => {
            const https = require('https');

            https.get(url, (response) => {
                let data = '';

                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error(`Error parsing JSON: ${error.message}`));
                    }
                });

            }).on('error', (error) => {
                reject(new Error(`HTTP request failed: ${error.message}`));
            });
        });
    }

    capitalizeName(name) {
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    cleanPokemonNumber(numberStr) {
        const match = numberStr.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        await this.browserManager.close();
    }
}

module.exports = PokemonScraper;