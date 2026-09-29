/** @jest-environment jsdom */
import {xsrfToken, putProject, fetchProject, isChallenge, NETWORK_MESSAGE} from '../../../src/lib/academycode/api.js';

beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=abc%3D%3D; path=/';
});

test('lit et décode le jeton XSRF du cookie', () => {
    expect(xsrfToken()).toBe('abc==');
});

test('putProject envoie le blob brut avec le jeton, en même origine', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({saved: true})}));
    const blob = new Blob(['x']);
    const data = await putProject('12', blob);
    expect(global.fetch).toHaveBeenCalledWith('/app/atelier/12/projet', expect.objectContaining({
        method: 'PUT',
        body: blob,
        credentials: 'same-origin',
        headers: expect.objectContaining({'X-XSRF-TOKEN': 'abc==', 'Content-Type': 'application/octet-stream'})
    }));
    expect(data.saved).toBe(true);
});

test('un refus du serveur remonte son message pédagogique', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ok: false, json: () => Promise.resolve({message: 'Ton projet est trop lourd'})}));
    // Jest 21 : `rejects` ne se combine pas avec `toThrow`, on inspecte l'erreur à la main.
    await putProject('12', new Blob(['x'])).then(
        () => { throw new Error('putProject aurait dû échouer'); },
        error => expect(error.message).toBe('Ton projet est trop lourd')
    );
});

test('une panne réseau donne un message pédagogique', async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    await putProject('12', new Blob(['x'])).then(
        () => { throw new Error('putProject aurait dû échouer'); },
        error => expect(error.message).toBe(NETWORK_MESSAGE)
    );
});

// Projet de départ d'un défi (en-tête X-AcademyCode-Depart) : pas encore le travail de l'enfant,
// l'éditeur ne dit donc pas « Ton projet a été rechargé » (simulation du 28/09/2026).
test('fetchProject distingue le projet de départ du travail de l\'enfant', async () => {
    const buffer = new ArrayBuffer(4);
    const reponse = depart => ({
        status: 200,
        ok: true,
        headers: {get: nom => (nom === 'X-AcademyCode-Depart' && depart ? '1' : null)},
        arrayBuffer: () => Promise.resolve(buffer)
    });
    global.fetch = jest.fn(() => Promise.resolve(reponse(true)));
    await expect(fetchProject('defi-5')).resolves.toEqual({buffer, depart: true});
    global.fetch = jest.fn(() => Promise.resolve(reponse(false)));
    await expect(fetchProject('defi-5')).resolves.toEqual({buffer, depart: false});
});

test('fetchProject renvoie null quand l\'enfant n\'a pas encore de projet (204)', async () => {
    global.fetch = jest.fn(() => Promise.resolve({status: 204, ok: true}));
    await expect(fetchProject('12')).resolves.toBeNull();
});

// Défi ou leçon : le pont adapte ses libellés (« Voir ma preuve ») et ferme la bulle de consignes
// dans un défi, où la mission est déjà écrite sur la page (simulation du 28/09/2026).
test('isChallenge reconnaît un défi à son préfixe « defi- »', () => {
    expect(isChallenge('defi-5')).toBe(true);
    expect(isChallenge('12')).toBe(false);
    expect(isChallenge('preuve-3')).toBe(false);
    expect(isChallenge(null)).toBe(false);
});
