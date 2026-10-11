// Plein écran de l'éditeur (lot L4, 11/10/2026) : API standard, ou préfixée webkit (anciens Safari d'iPad).
// Sans aucune des deux, le bouton « Plein écran » n'est pas proposé (jamais un bouton qui ne fait rien).

/**
 * Le navigateur sait-il mettre ce document en plein écran ?
 * @param {Document} doc - document de l'éditeur
 * @returns {boolean} disponible
 */
export const disponible = doc => Boolean(
    (doc.fullscreenEnabled || doc.webkitFullscreenEnabled) &&
    (doc.documentElement.requestFullscreen || doc.documentElement.webkitRequestFullscreen)
);

/**
 * L'éditeur est-il en plein écran ?
 * @param {Document} doc - document de l'éditeur
 * @returns {boolean} en plein écran
 */
export const actif = doc => Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);

/**
 * Entre en plein écran, ou en sort s'il y est déjà.
 * @param {Document} doc - document de l'éditeur
 */
export const basculer = doc => {
    if (actif(doc)) {
        (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
        return;
    }
    const el = doc.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
};

/**
 * Sort du plein écran s'il est actif.
 * @param {Document} doc - document de l'éditeur
 */
export const sortir = doc => {
    if (actif(doc)) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
};

/** Événements de changement d'état (standard et webkit). */
export const EVENEMENTS = ['fullscreenchange', 'webkitfullscreenchange'];
