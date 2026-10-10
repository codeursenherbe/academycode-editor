/** @jest-environment jsdom */
import {absolu} from '../../../src/lib/storage.js';

// Les assets sont téléchargés dans un worker blob: : un chemin relatif n'y est pas résolu (chargement bloqué).
test('les adresses des assets deviennent absolues', () => {
    const page = 'https://animateurs.exemple.test/editeur/index.html?projet=x';
    expect(absolu('/editeur/static/lib-assets', page)).toBe('https://animateurs.exemple.test/editeur/static/lib-assets');
    expect(absolu('static/extension-assets/scratch3_music/a.wav', page))
        .toBe('https://animateurs.exemple.test/editeur/static/extension-assets/scratch3_music/a.wav');
    expect(absolu('https://autre.test/lib', page)).toBe('https://autre.test/lib');
    expect(absolu('/editeur/static/lib-assets', 'about:blank')).toBe('/editeur/static/lib-assets');
});
