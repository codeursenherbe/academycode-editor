/** @jest-environment jsdom */
import {xsrfToken, putProject, fetchProject, NETWORK_MESSAGE} from '../../../src/lib/academycode/api.js';

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

test('fetchProject renvoie null quand l\'enfant n\'a pas encore de projet (204)', async () => {
    global.fetch = jest.fn(() => Promise.resolve({status: 204, ok: true}));
    await expect(fetchProject('12')).resolves.toBeNull();
});
