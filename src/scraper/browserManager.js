const puppeteer = require('puppeteer');

class BrowserManager {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        console.log('Inicializando navegador...');
        
        this.browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--exclude-switches=enable-automation',
                '--disable-extensions'
            ],
            defaultViewport: null,
            ignoreHTTPSErrors: true,
            ignoreDefaultArgs: ['--enable-automation'],
            slowMo: 500
        });

        this.page = await this.browser.newPage();
        
        const userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await this.page.setUserAgent(randomUA);

        await this.page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1'
        });

        await this.page.evaluateOnNewDocument(() => {
            delete navigator.__proto__.webdriver;
            delete navigator.webdriver;
            
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['es-ES', 'es', 'en']
            });
            
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
        });

        this.page.setDefaultTimeout(120000);
        this.page.setDefaultNavigationTimeout(180000);

        console.log('Navegador inicializado correctamente');
        
        return { browser: this.browser, page: this.page };
    }

    async close() {
        console.log('Cerrando navegador...');
        
        if (this.page) {
            await this.page.close();
        }
        
        if (this.browser) {
            await this.browser.close();
        }
        
        console.log('Navegador cerrado correctamente');
    }

    async humanDelay(min = 2000, max = 5000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`Esperando ${delay}ms...`);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    async humanScroll(page) {
        console.log('Realizando scroll...');
        
        await page.evaluate(() => {
            return new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if(totalHeight >= scrollHeight * 0.7){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
        
        await this.humanDelay(1000, 3000);
    }

    async waitForAnySelector(selectors, timeout = 30000) {
        const promises = selectors.map(selector => 
            this.page.waitForSelector(selector, { timeout })
                .then(() => selector)
                .catch(() => null)
        );
        
        const result = await Promise.race(promises);
        if (result) {
            console.log(`Encontrado selector: ${result}`);
            return result;
        }
        
        throw new Error(`Ningún selector encontrado: ${selectors.join(', ')}`);
    }
}

module.exports = BrowserManager;