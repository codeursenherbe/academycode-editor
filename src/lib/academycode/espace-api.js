import {xsrfToken, NETWORK_MESSAGE} from './api.js';

/**
 * Contexte « Espace Animateur » (09/10/2026) : /editeur/index.html?projet=/ressources/12/scratch/2/copie&mode=copie
 *
 * `projet` est le chemin d'API d'une référence (/reference) ou d'une copie personnelle (/copie) d'une étape, en MÊME
 * origine ; `mode` dit ce que l'éditeur en fait :
 *  - lecture      : référence officielle, jamais enregistrée ;
 *  - copie        : version personnelle, enregistrée automatiquement ;
 *  - presentation : scène seule (lecteur), rien n'est modifiable ni enregistré.
 * Le chemin est validé strictement (forme exacte des routes de l'Espace) : jamais une URL libre.
 * Sans ces deux paramètres valides, l'éditeur se comporte comme avant (AcademyCode : ?lecon=, ?lecteur=).
 */
export const CHEMIN_ESPACE = /^\/ressources\/\d{1,9}\/scratch\/[1-4]\/(reference|copie)$/;
export const MODES_ESPACE = ['lecture', 'copie', 'presentation'];

/**
 * @param {string} search - la partie « ?… » de l'URL
 * @returns {?{path: string, mode: string}} le contexte, ou null hors Espace Animateur (ou si invalide)
 */
export const espaceContext = (search = window.location.search) => {
    const params = new URLSearchParams(search);
    const path = params.get('projet');
    const mode = params.get('mode');
    if (!path || !CHEMIN_ESPACE.test(path) || !MODES_ESPACE.includes(mode)) return null;
    // La référence est en lecture seule : le seul mode qui écrit vise obligatoirement une copie.
    if (mode === 'copie' && !path.endsWith('/copie')) return null;
    return {path, mode};
};

/**
 * @param {string} path - chemin validé (espaceContext)
 * @returns {Promise<?{buffer: ArrayBuffer, depart: boolean}>} null si rien à charger ; `depart` vrai quand le serveur
 *     sert la référence faute de copie personnelle
 */
export const fetchEspaceProject = async path => {
    const response = await fetch(path, {credentials: 'same-origin', cache: 'no-store'});
    if (response.status === 204 || response.status === 404) return null;
    if (!response.ok) throw new Error('Le projet n’a pas pu être chargé.');
    return {
        buffer: await response.arrayBuffer(),
        depart: response.headers.get('X-Copie-Depart') === '1'
    };
};

/**
 * @param {string} path - chemin de la copie (…/copie)
 * @param {Blob} blob - le projet .sb3
 * @returns {Promise<object>} réponse JSON du serveur ; jette une Error au message pédagogique sinon
 */
export const putEspaceProject = async (path, blob) => {
    let response;
    try {
        response = await fetch(path, {
            method: 'PUT',
            body: blob,
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Accept': 'application/json',
                'X-XSRF-TOKEN': xsrfToken()
            }
        });
    } catch (error) {
        throw new Error(NETWORK_MESSAGE);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || NETWORK_MESSAGE);
    return data;
};

/**
 * « Repartir de la référence » : le serveur supprime la copie et resservira la référence.
 * @param {string} path - chemin de la copie (…/copie)
 * @returns {Promise<object>} la réponse du serveur
 */
export const restartEspace = async path => {
    let response;
    try {
        response = await fetch(`${path}/repartir`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Accept': 'application/json', 'X-XSRF-TOKEN': xsrfToken()}
        });
    } catch (error) {
        throw new Error(NETWORK_MESSAGE);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'On n’a pas pu repartir de la référence. Ta version n’a pas changé.');
    }
    return data;
};
