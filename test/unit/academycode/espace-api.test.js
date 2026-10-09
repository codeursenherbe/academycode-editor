/** @jest-environment jsdom */
import {
    espaceContext, fetchEspaceProject, putEspaceProject, restartEspace, consignesUrl, fetchEspaceConsignes
} from '../../../src/lib/academycode/espace-api.js';
import {NETWORK_MESSAGE} from '../../../src/lib/academycode/api.js';

// Le jsdom de Jest 21 n'expose pas URLSearchParams (les navigateurs, si) : celui de Node est identique.
global.URLSearchParams = require('url').URLSearchParams;

beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=abc%3D%3D; path=/';
});

const url = (projet, mode) => `?projet=${encodeURIComponent(projet)}&mode=${mode}`;

test('accepte les routes exactes de l’Espace Animateur et leurs trois modes', () => {
    expect(espaceContext(url('/ressources/12/scratch/2/copie', 'copie'))).toEqual({path: '/ressources/12/scratch/2/copie', mode: 'copie'});
    expect(espaceContext(url('/ressources/12/scratch/4/reference', 'lecture'))).toEqual({path: '/ressources/12/scratch/4/reference', mode: 'lecture'});
    expect(espaceContext(url('/ressources/12/scratch/1/copie', 'presentation')).mode).toBe('presentation');
});

test('refuse tout chemin qui n’est pas une route de l’Espace (pas d’URL libre, pas d’échappement de dossier)', () => {
    const mauvais = [
        'https://evil.example/ressources/12/scratch/2/copie',
        '//evil.example/ressources/12/scratch/2/copie',
        '/ressources/12/scratch/2/copie/../../../app/atelier/3/projet',
        '/ressources/12/scratch/5/copie',
        '/ressources/12/scratch/0/reference',
        '/ressources/abc/scratch/2/copie',
        '/ressources/12/scratch/2/copie?x=1',
        '/ressources/12/scratch/2/copie/repartir',
        '/app/atelier/12/projet',
        ''
    ];
    for (const chemin of mauvais) {
        expect(espaceContext(url(chemin, 'copie'))).toBeNull();
    }
});

test('refuse un mode inconnu ou absent, et l’écriture sur une référence', () => {
    expect(espaceContext(url('/ressources/12/scratch/2/copie', 'edition'))).toBeNull();
    expect(espaceContext('?projet=%2Fressources%2F12%2Fscratch%2F2%2Fcopie')).toBeNull();
    // Le mode « copie » (le seul qui enregistre) ne peut viser qu’une copie, jamais la référence.
    expect(espaceContext(url('/ressources/12/scratch/2/reference', 'copie'))).toBeNull();
});

test('hors Espace Animateur (AcademyCode : ?lecon=, ?lecteur=), aucun contexte : comportement inchangé', () => {
    expect(espaceContext('?lecon=12')).toBeNull();
    expect(espaceContext('?lecteur=la-machine-qui-accelere')).toBeNull();
    expect(espaceContext('')).toBeNull();
});

const reponse = (depart, status = 200) => ({
    status,
    ok: status === 200,
    headers: {get: nom => (nom === 'X-Copie-Depart' && depart ? '1' : null)},
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(4))
});

test('fetchEspaceProject distingue la référence servie par défaut de la copie personnelle', async () => {
    global.fetch = jest.fn(() => Promise.resolve(reponse(true)));
    expect((await fetchEspaceProject('/ressources/12/scratch/2/copie')).depart).toBe(true);
    global.fetch = jest.fn(() => Promise.resolve(reponse(false)));
    expect((await fetchEspaceProject('/ressources/12/scratch/2/copie')).depart).toBe(false);
    global.fetch = jest.fn(() => Promise.resolve(reponse(false, 204)));
    expect(await fetchEspaceProject('/ressources/12/scratch/2/copie')).toBeNull();
});

test('putEspaceProject envoie le blob brut avec le jeton, en même origine', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({saved: true})}));
    const blob = new Blob(['x']);
    await putEspaceProject('/ressources/12/scratch/2/copie', blob);
    expect(global.fetch).toHaveBeenCalledWith('/ressources/12/scratch/2/copie', expect.objectContaining({
        method: 'PUT',
        body: blob,
        credentials: 'same-origin',
        headers: expect.objectContaining({'X-XSRF-TOKEN': 'abc==', 'Content-Type': 'application/octet-stream'})
    }));
});

test('un refus du serveur remonte son message ; une panne réseau donne le message pédagogique', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ok: false, json: () => Promise.resolve({message: 'Fichier trop gros'})}));
    await putEspaceProject('/ressources/12/scratch/2/copie', new Blob(['x'])).then(
        () => { throw new Error('aurait dû échouer'); },
        error => expect(error.message).toBe('Fichier trop gros')
    );
    global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    await putEspaceProject('/ressources/12/scratch/2/copie', new Blob(['x'])).then(
        () => { throw new Error('aurait dû échouer'); },
        error => expect(error.message).toBe(NETWORK_MESSAGE)
    );
});

test('restartEspace appelle …/copie/repartir en POST avec le jeton', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({message: 'ok'})}));
    await restartEspace('/ressources/12/scratch/2/copie');
    expect(global.fetch).toHaveBeenCalledWith('/ressources/12/scratch/2/copie/repartir', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({'X-XSRF-TOKEN': 'abc=='})
    }));
});

test('l’adresse des consignes se déduit de la référence ou de la copie, de la même étape', () => {
    expect(consignesUrl('/ressources/12/scratch/2/copie')).toBe('/ressources/12/scratch/2/consignes');
    expect(consignesUrl('/ressources/119/scratch/4/reference')).toBe('/ressources/119/scratch/4/consignes');
});

test('fetchEspaceConsignes renvoie les consignes, ou null sans jamais gêner l’éditeur', async () => {
    const consignes = {titre: 'Étape', objectif: 'x', etapes: ['a'], criteres: ['b']};
    global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve(consignes)}));
    expect(await fetchEspaceConsignes('/ressources/12/scratch/2/copie')).toEqual(consignes);
    expect(global.fetch.mock.calls[0][0]).toBe('/ressources/12/scratch/2/consignes');
    global.fetch = jest.fn(() => Promise.resolve({ok: false}));
    expect(await fetchEspaceConsignes('/ressources/12/scratch/2/copie')).toBeNull();
    global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await fetchEspaceConsignes('/ressources/12/scratch/2/copie')).toBeNull();
});
