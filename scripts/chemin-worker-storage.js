// Loader webpack (AcademyCode) : scratch-storage est livré déjà compilé avec un chemin public figé à « / », il cherche
// donc son worker de téléchargement à la RACINE du site (/chunks/fetch-worker.*.js) et non à côté de l'éditeur
// (/editeur/chunks/). Absent, toute image ou tout son non préchargé de la bibliothèque attend sans fin (constaté en
// production le 11/10/2026). Un chemin vide résout le worker par rapport à la page de l'éditeur (document.baseURI).
// Échoue si le motif change (nouvelle version de scratch-storage) : à revoir plutôt qu'une régression silencieuse.
const MOTIF = '__webpack_require__.p = "/";';

module.exports = function cheminWorkerStorage (source) {
    const occurrences = source.split(MOTIF).length - 1;
    if (occurrences !== 1) {
        throw new Error(`chemin-worker-storage : ${occurrences} occurrence(s) de ${MOTIF} (1 attendue)`);
    }
    return source.replace(MOTIF, '__webpack_require__.p = "";');
};

module.exports.MOTIF = MOTIF;
