/**
 * Vérification du comportement d'un projet Scratch (pilote « Programme mystère » d'AcademyCode, étape 2, 09/10/2026).
 *
 * On compare ce que FAIT le jeu de l'enfant à ce que fait la machine mystère, jamais la façon dont ses blocs sont
 * assemblés. Chaque projet tourne dans une scratch-vm à part, sans rendu, à horloge simulée, image par image :
 * - au drapeau vert, le niveau que le jeu se donne tout seul (avant toute intervention du test) ;
 * - pour chaque score de la liste : remise à zéro (score 0, niveau 1), score imposé, quelques images, puis lecture du
 *   niveau et des pas faits vers le bas, en une image, par les objets qui tombent (sprites et clones) ;
 * - le jeu de l'enfant est jugé pareil à la machine pour un score si le niveau est le même et si au moins un objet
 *   tombe exactement à la vitesse de la machine.
 *
 * Quand on ne peut pas savoir, on le dit (« impossible ») plutôt que d'annoncer une erreur : variable introuvable ou en
 * double, niveau qui ne réagit jamais à un score imposé, rien qui tombe, exécution trop longue.
 *
 * Ce que cela prouve : pour CES situations, le jeu réagit comme la machine. Pas qu'il est correct en général.
 */
import VM from 'scratch-vm';

const IMAGE_MS = 1000 / 30;

/**
 * Les variables d'un nom donné (minuscules, espaces retirés), sur la scène et dans les sprites originaux.
 * @param {object} runtime - le runtime de la VM
 * @param {string} nom - le nom cherché, en minuscules
 * @returns {Array} les variables trouvées
 */
const variables = (runtime, nom) => runtime.targets
    .filter(t => t.isOriginal)
    .flatMap(t => Object.values(t.variables))
    .filter(v => v.type === '' && String(v.name)
        .trim()
        .toLowerCase() === nom);

/**
 * La valeur la plus fréquente d'une liste.
 * @param {Array<number>} liste - des valeurs
 * @returns {?number} la plus fréquente, ou null si la liste est vide
 */
const plusFrequent = liste => {
    const n = new Map();
    for (const x of liste) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/**
 * La raison de ne pas pouvoir suivre une variable (absente, ou plusieurs du même nom).
 * @param {Array} trouvees - les variables trouvées
 * @param {string} nom - leur nom
 * @returns {?string} la raison, ou null si une seule variable a été trouvée
 */
const raisonVariable = (trouvees, nom) => {
    if (trouvees.length === 1) return null;
    if (trouvees.length === 0) return `le test ne trouve pas de variable « ${nom} » dans ton jeu`;
    return `ton jeu a plusieurs variables « ${nom} », le test ne sait pas laquelle suivre`;
};

/**
 * Exécute un projet et relève, pour chaque score, le niveau et les pas vers le bas des objets qui tombent.
 * @param {ArrayBuffer|Buffer} projet - le .sb3
 * @param {object} config - scores, variables, images_demarrage, images_par_score, pas_max, budget_ms
 * @param {object} storage - un ScratchStorage (celui de l'éditeur, dans le navigateur)
 * @returns {Promise<object>} {table} ou {impossible: raison}
 */
export const observer = async (projet, config, storage) => {
    const vm = new VM();
    if (storage) vm.attachStorage(storage);
    try {
        await vm.loadProject(projet);
    } catch (e) {
        return {impossible: 'ton projet ne s’est pas chargé pour le test'};
    }
    const rt = vm.runtime;
    const noms = {score: config.variables?.score ?? 'score', niveau: config.variables?.niveau ?? 'niveau'};
    const vScore = variables(rt, noms.score.toLowerCase());
    const vNiveau = variables(rt, noms.niveau.toLowerCase());
    const raison = raisonVariable(vScore, noms.score) ?? raisonVariable(vNiveau, noms.niveau);
    if (raison) {
        vm.quit();
        return {impossible: raison, manque: vScore.length === 0 || (vScore.length === 1 && vNiveau.length === 0)};
    }
    const score = vScore[0];
    const niveau = vNiveau[0];
    // Horloge simulée, le temps du test seulement : les « attendre » de Scratch lisent Date.now. Tout ce qui suit est
    // synchrone : la VM de l'éditeur ne tourne pas pendant ce temps, et l'horloge est rendue dans le finally.
    const vraiNow = Date.now;
    const limite = vraiNow() + (config.budget_ms ?? 8000);
    let horloge = vraiNow();
    // Chaque lecture avance un peu : aucune boucle ne tourne sans fin dans une image.
    Date.now = () => (horloge += 0.05);
    // Sans rendu, un déplacement ne demande pas de redessiner : une boucle tournerait plusieurs fois par image.
    // Comme dans l'éditeur, chaque déplacement demande un rendu (sprites et clones).
    const pousser = t => {
        const setXY = t.setXY;
        t.setXY = function (...a) {
            setXY.apply(this, a);
            this.runtime.requestRedraw();
        };
    };
    try {
        rt.currentStepTime = IMAGE_MS;
        rt.targets.forEach(pousser);
        rt.on('targetWasCreated', pousser);
        const images = n => {
            for (let i = 0; i < n; i++) {
                horloge += IMAGE_MS;
                rt._step();
                if (vraiNow() > limite) throw new Error('trop long');
            }
        };
        vm.greenFlag();
        images(config.images_demarrage ?? 10);
        const depart = Number(niveau.value);
        const table = [];
        for (const s of config.scores) {
            score.value = 0;
            niveau.value = 1;
            images(2);
            score.value = s;
            images(config.images_par_score ?? 45);
            const avant = new Map(rt.targets.filter(t => !t.isStage && t.visible).map(t => [t.id, t.y]));
            images(1);
            const pas = rt.targets
                .filter(t => avant.has(t.id))
                .map(t => Math.round((avant.get(t.id) - t.y) * 100) / 100)
                .filter(d => d > 0 && d <= (config.pas_max ?? 40));
            table.push({
                score: s,
                niveau: Number(niveau.value),
                pas: [...new Set(pas)].sort((a, b) => a - b),
                pasPrincipal: plusFrequent(pas)
            });
        }
        return {depart, table};
    } catch (e) {
        return {impossible: 'le test a pris trop de temps'};
    } finally {
        Date.now = vraiNow;
        rt.removeListener('targetWasCreated', pousser);
        vm.quit();
    }
};

const RAISON_NIVEAU_FIGE = 'ton niveau ne change jamais pendant le test, quel que soit le score donné ; ' +
    'peut-être que ton jeu ne démarre pas au drapeau vert, ou qu’il ne change de niveau qu’au moment où tu marques ' +
    'un point, et ce test ne peut pas le voir';

/**
 * Compare le jeu de l'enfant à la machine, score par score.
 * @param {object} machine - l'observation de la machine mystère ({table})
 * @param {object} enfant - l'observation du jeu de l'enfant ({table} ou {impossible})
 * @returns {object} {verdict: conforme | different | impossible, ecart?, raison?}
 */
export const comparer = (machine, enfant) => {
    if (enfant.impossible) return {verdict: 'impossible', raison: enfant.impossible, manque: enfant.manque};
    if (machine.impossible) return {verdict: 'impossible', raison: 'la machine mystère ne s’est pas laissée observer'};
    const machineMonte = machine.table.some(l => l.niveau > 1);
    // Un niveau qui ne bouge jamais quand on impose un score : on ne peut pas savoir pourquoi, on ne conclut pas.
    if (machineMonte && enfant.table.every(l => l.niveau === 1)) {
        return {verdict: 'impossible', raison: RAISON_NIVEAU_FIGE};
    }
    if (enfant.table.every(l => l.pas.length === 0)) {
        return {verdict: 'impossible', raison: 'rien ne tombe dans ton jeu pendant le test'};
    }
    // La remise à « niveau 1 » avant chaque score masquerait un jeu qui démarre à un autre niveau (vu en simulation).
    if (machine.depart !== enfant.depart) {
        const ecart = {score: 0, quoi: 'depart', machine: machine.depart, enfant: enfant.depart};
        return {verdict: 'different', ecart};
    }
    for (const [i, m] of machine.table.entries()) {
        const e = enfant.table[i];
        if (e.niveau !== m.niveau) {
            return {verdict: 'different', ecart: {score: m.score, quoi: 'niveau', machine: m.niveau, enfant: e.niveau}};
        }
        if (m.pasPrincipal !== null && e.pas.length && !e.pas.includes(m.pasPrincipal)) {
            const ecart = {score: m.score, quoi: 'pas', machine: m.pasPrincipal, enfant: e.pasPrincipal};
            return {verdict: 'different', ecart};
        }
    }
    if (enfant.table.some(l => l.pas.length === 0)) {
        const raison = 'pour certains scores, rien ne tombait dans ton jeu au moment de la mesure';
        return {verdict: 'impossible', raison};
    }
    return {verdict: 'conforme'};
};

/**
 * Le message pour l'enfant : ce qui a été observé, sans donner la règle.
 * @param {object} resultat - le résultat de comparer
 * @param {object} config - dont `scores` et `caches` (scores non suggérés dans la leçon)
 * @returns {string} une phrase ou deux
 */
export const message = (resultat, config) => {
    if (resultat.verdict === 'conforme') {
        const min = Math.min(...config.scores);
        const max = Math.max(...config.scores);
        return `Pour les ${config.scores.length} situations testées (des scores de ${min} à ${max}), ` +
            'ton jeu réagit comme la machine mystère : mêmes niveaux, même vitesse. ' +
            'Le test ne couvre pas tout, mais ta règle tient.';
    }
    if (resultat.verdict === 'impossible' && resultat.manque) {
        // La leçon demande ce nom : ici, ce n'est pas « peut-être une erreur », c'est ce qui manque pour comparer.
        return `Vérification impossible : ${resultat.raison}. C’est sous ce nom exact que le test la compare à la ` +
            'machine : vérifie son nom, ou crée-la.';
    }
    if (resultat.verdict === 'impossible') {
        return `Vérification impossible : ${resultat.raison}. ` +
            'Ce n’est pas forcément une erreur de ton jeu : compare-le toi-même à la machine.';
    }
    const {score, quoi, machine, enfant} = resultat.ecart;
    if (quoi === 'depart') {
        return `Juste après le drapeau vert, ton jeu affiche le niveau ${enfant} ; la machine, le niveau ${machine}. ` +
            'Compare-les au tout début de la partie.';
    }
    if ((config.caches ?? []).includes(score)) {
        return 'Pour les scores que tu as sans doute essayés, ton jeu et la machine sont d’accord. ' +
            `Mais pour un score plus grand, ${quoi === 'niveau' ? 'le niveau' : 'la vitesse'} n’est pas la même. ` +
            'Essaie d’aller plus loin avec la machine.';
    }
    if (quoi === 'niveau') {
        return `Avec un score de ${score}, ton jeu affiche le niveau ${enfant} ; la machine, le niveau ${machine}. ` +
            'Compare-les à ce score-là.';
    }
    return `Avec un score de ${score}, ton météore descend de ${enfant} pas par image ; ` +
        `celui de la machine, de ${machine}. Compare-les à ce score-là.`;
};
