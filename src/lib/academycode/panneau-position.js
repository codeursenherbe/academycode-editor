// Position du panneau de consignes (lot L2, 11/10/2026) : bornée dans la fenêtre, mémorisée par leçon.
// Logique pure (aucun DOM) pour être testée ; le pont (bridge-hoc.jsx) s'en sert pendant le déplacement.

// Le panneau doit toujours laisser saisir son bandeau : au moins VISIBLE px dans la largeur, et jamais sous la barre
// de menus ni sous le bas de la fenêtre.
export const VISIBLE = 120;
export const HAUT_MIN = 48;
export const BANDEAU = 36;

const cle = lecon => `academycode:consignes:${lecon}`;

// Déplacement au clavier (lot L3) : flèches 10 px, Maj + flèches 50 px.
const PAS = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};

/**
 * Nouvelle position après une flèche du clavier, ou null si la touche ne déplace pas le panneau.
 * @param {{x: number, y: number}} position - position actuelle
 * @param {string} touche - KeyboardEvent.key
 * @param {boolean} grand - Maj enfoncée
 * @returns {{x: number, y: number}|null} position voulue (à borner ensuite)
 */
export const deplacer = (position, touche, grand) => {
    const pas = PAS[touche];
    if (!pas) return null;
    const n = grand ? 50 : 10;
    return {x: position.x + (pas[0] * n), y: position.y + (pas[1] * n)};
};

/**
 * Ramène une position dans la fenêtre.
 * @param {{x: number, y: number}} position - coin haut-gauche voulu
 * @param {number} largeur - largeur du panneau
 * @param {{w: number, h: number}} fenetre - taille de la fenêtre
 * @returns {{x: number, y: number}} position bornée
 */
export const borner = (position, largeur, fenetre) => ({
    x: Math.round(Math.min(Math.max(position.x, VISIBLE - largeur), fenetre.w - VISIBLE)),
    y: Math.round(Math.min(Math.max(position.y, HAUT_MIN), fenetre.h - BANDEAU))
});

/**
 * Position mémorisée pour cette leçon, ou null (rien, valeur abîmée, stockage interdit).
 * @param {Storage} stockage - localStorage
 * @param {string} lecon - identifiant de la leçon
 * @returns {{x: number, y: number}|null} position mémorisée
 */
export const lire = (stockage, lecon) => {
    try {
        const p = JSON.parse(stockage.getItem(cle(lecon)));
        return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? {x: p.x, y: p.y} : null;
    } catch (e) {
        return null;
    }
};

/**
 * Mémorise la position (sans erreur si le stockage est plein ou interdit).
 * @param {Storage} stockage - localStorage
 * @param {string} lecon - identifiant de la leçon
 * @param {{x: number, y: number}} position - position à garder
 */
export const ecrire = (stockage, lecon, position) => {
    try {
        stockage.setItem(cle(lecon), JSON.stringify({x: position.x, y: position.y}));
    } catch (e) {
        // navigation privée stricte : le panneau reviendra simplement à sa place par défaut
    }
};

// Écart gardé entre le panneau et le bord droit de la zone de code.
export const MARGE = 16;

/**
 * Place du panneau quand l'enfant ne l'a pas déplacé (recette du 14/10/2026 : à l'ouverture, il recouvrait le
 * programme repris de la leçon précédente). S'il recouvre les scripts, il passe à droite de la zone de code, si ce
 * côté est libre ; sinon il garde sa place par défaut (l'enfant peut toujours le déplacer). Jamais mémorisée.
 * @param {{left: number, top: number, right: number, bottom: number}} zone - zone de code (coordonnées écran)
 * @param {{left: number, top: number, right: number, bottom: number}|null} scripts - scripts visibles, ou null
 * @param {{x: number, y: number, w: number, h: number}} panneau - place par défaut et taille du panneau
 * @returns {{x: number, y: number}|null} position à prendre, ou null pour garder la place par défaut
 */
export const placeLibre = (zone, scripts, panneau) => {
    if (!scripts) return null;
    const recouvre = x => x < scripts.right && x + panneau.w > scripts.left &&
        panneau.y < scripts.bottom && panneau.y + panneau.h > scripts.top;
    if (!recouvre(panneau.x)) return null;
    const droite = Math.round(zone.right - panneau.w - MARGE);
    return droite > panneau.x && !recouvre(droite) ? {x: droite, y: panneau.y} : null;
};
