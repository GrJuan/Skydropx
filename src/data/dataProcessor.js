class DataProcessor {
    processData(rawData) {
        return rawData.map((pokemon, index) => {
            try {
                return {
                    number: this.processNumber(pokemon.number),
                    name: this.processName(pokemon.name),
                    description: this.processDescription(pokemon.description),
                    types: this.processTypes(pokemon.types),
                    imageUrl: this.processImageUrl(pokemon.imageUrl)
                };
            } catch (error) {
                return this.createEmptyRecord(index + 1);
            }
        });
    }

    processNumber(number) {
        if (typeof number === 'number') return number;
        if (typeof number === 'string') {
            const cleanNumber = number.replace(/[^\d]/g, '');
            const parsed = parseInt(cleanNumber);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    processName(name) {
        if (!name || typeof name !== 'string') return 'Desconocido';

        return name.trim()
            .replace(/\s+/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    processDescription(description) {
        if (!description || typeof description !== 'string') return 'Descripción no disponible';

        return description.trim()
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .slice(0, 500);
    }

    processTypes(types) {
        if (!types || typeof types !== 'string') return 'Desconocido';

        const cleanTypes = types.trim()
            .split(/[,\/]/)
            .map(type => type.trim())
            .filter(type => type.length > 0)
            .map(type => type.charAt(0).toUpperCase() + type.slice(1).toLowerCase());

        return cleanTypes.length > 0 ? cleanTypes.join('/') : 'Desconocido';
    }

    processImageUrl(imageUrl) {
        if (!imageUrl || typeof imageUrl !== 'string') return '';

        try {
            new URL(imageUrl);
            return imageUrl.trim();
        } catch {
            return '';
        }
    }

    createEmptyRecord(number) {
        return {
            number: number,
            name: `Pokémon #${number}`,
            description: 'Datos no disponibles',
            types: 'Desconocido',
            imageUrl: ''
        };
    }
}

module.exports = DataProcessor;