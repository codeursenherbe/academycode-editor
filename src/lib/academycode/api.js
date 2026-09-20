export const NETWORK_MESSAGE = 'Ton projet n\'est pas encore sauvegardé, on réessaie.';

/**
 * Identifiant de la leçon, passé par la page AcademyCode : /editeur/index.html?lecon=12
 * @returns {?string} l'identifiant, ou null hors atelier
 */
export const lessonId = () => new URLSearchParams(window.location.search).get('lecon');

export const projectUrl = id => `/app/atelier/${encodeURIComponent(id)}/projet`;

/**
 * Jeton CSRF de Laravel : cookie XSRF-TOKEN (lisible en JS, même origine), envoyé en en-tête.
 * @returns {string} le jeton décodé, ou une chaîne vide si le cookie est absent
 */
export const xsrfToken = () => {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
};

/**
 * @param {string} id - identifiant de la leçon
 * @returns {Promise<ArrayBuffer|null>} null si l'enfant n'a pas encore de projet
 */
export const fetchProject = async id => {
    const response = await fetch(projectUrl(id), {credentials: 'same-origin', cache: 'no-store'});
    if (response.status === 204 || response.status === 404) return null;
    if (!response.ok) throw new Error('Le projet n\'a pas pu être rechargé.');
    return response.arrayBuffer();
};

/**
 * @param {string} id - identifiant de la leçon
 * @param {Blob} blob - le projet .sb3 à envoyer
 * @returns {Promise<object>} réponse JSON du serveur ; jette une Error au message pédagogique sinon
 */
export const putProject = async (id, blob) => {
    let response;
    try {
        response = await fetch(projectUrl(id), {
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
