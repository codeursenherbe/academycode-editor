/** @jest-environment jsdom */
import {
    chargerBibliothequeEspace, oublierBibliothequeEspace, etiquettesEspace, URL_BIBLIOTHEQUE
} from '../../../src/lib/academycode/bibliotheque-espace.jsx';

// Le jsdom de Jest 21 n'expose pas URLSearchParams (les navigateurs, si) : celui de Node est identique.
global.URLSearchParams = require('url').URLSearchParams;

const ESPACE = `?projet=${encodeURIComponent('/ressources/12/scratch/2/copie')}&mode=copie`;
const BIB = {sprites: [{name: 'chevalier'}], backdrops: [], costumes: [], themes: [{tag: 'codeurs-en-herbe', label: 'Codeurs en Herbe'}]};

beforeEach(() => {
    oublierBibliothequeEspace();
    global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve(BIB)}));
});

test('hors Espace (AcademyCode) : aucune requête, aucune bibliothèque', async () => {
    expect(await chargerBibliothequeEspace('?lecon=3')).toBeNull();
    expect(await chargerBibliothequeEspace('')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
});

test('en mode Espace : la bibliothèque est chargée une seule fois', async () => {
    expect(await chargerBibliothequeEspace(ESPACE)).toEqual(BIB);
    await chargerBibliothequeEspace(ESPACE);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(URL_BIBLIOTHEQUE);
});

test('réponse absente ou invalide : on garde la bibliothèque d\'origine', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ok: false}));
    expect(await chargerBibliothequeEspace(ESPACE)).toBeNull();
    oublierBibliothequeEspace();
    global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({pas: 'une bibliothèque'})}));
    expect(await chargerBibliothequeEspace(ESPACE)).toBeNull();
    oublierBibliothequeEspace();
    global.fetch = jest.fn(() => Promise.reject(new Error('réseau')));
    expect(await chargerBibliothequeEspace(ESPACE)).toBeNull();
});

test('catégories au format des boutons de scratch-gui', () => {
    expect(etiquettesEspace(BIB)).toEqual([{
        tag: 'codeurs-en-herbe',
        intlLabel: {id: 'gui.espace.bibliotheque.codeurs-en-herbe', defaultMessage: 'Codeurs en Herbe', description: 'Catégorie Codeurs en Herbe'}
    }]);
    expect(etiquettesEspace(null)).toEqual([]);
});
