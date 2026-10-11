// Finitions AcademyCode de la bibliothèque enrichie (11/10/2026), dans le style des dessins Codeurs en Herbe :
// - POSES : une 2e pose pour les sprites qui bougent (« costume suivant » anime vraiment), obtenue en déplaçant les
//   membres du dessin d'origine ; elle s'applique aussi à ses variantes de couleur (même géométrie) ;
// - DESSINS : pièce et clé redessinées (plus grandes, contour sombre + liseré clair : visibles sur tout fond) ;
// - DECORS : salle de classe, circuit, terrain de basket (sans texte, l'enfant y écrit ce qu'il veut) ;
// - AMBIANCES : soir (lumière chaude) et nuit (bleu sombre, soleil devenu lune), calculées depuis le décor de jour.
// Utilisé par scripts/bibliotheque-academycode.mjs.

// Remplace chaque motif (une seule fois chacun) ; un motif absent est une erreur : le dessin d'origine a changé.
const remplacer = (svg, regles) => regles.reduce((s, [motif, par]) => {
    if (!motif.test(s)) throw new Error(`motif absent : ${motif}`);
    return s.replace(motif, par);
}, svg);
const C = '#[0-9a-fA-F]{3,6}';
const interieur = svg => svg.match(/^(<svg[^>]*>)([\s\S]*)(<\/svg>)$/).slice(1);
const envelopper = (svg, transform) => {
    const [debut, corps, fin] = interieur(svg);
    return `${debut}<g transform="${transform}">${corps}</g>${fin}`;
};
const r1 = n => Math.round(n * 10) / 10;

// Personnage « perso » (60×96) : jambes droites, bras à ±15°. Pose « pas » : une jambe en avant, l'autre levée,
// bras qui balancent. La main suit le bras (pivot épaule, longueur 21,6).
const main = (x, angle) => [r1(x - 21.6 * Math.sin(angle * Math.PI / 180)), r1(46 + 21.6 * Math.cos(angle * Math.PI / 180))];
const bras = (gauche, droit) => {
    const [xg, yg] = main(11, gauche), [xd, yd] = main(49, droit);
    return [
        [/rotate\(15 11 46\)/, `rotate(${gauche} 11 46)`], [/rotate\(-15 49 46\)/, `rotate(${droit} 49 46)`],
        [/<circle cx="6" cy="67"/, `<circle cx="${xg}" cy="${yg}"`], [/<circle cx="54" cy="67"/, `<circle cx="${xd}" cy="${yd}"`]
    ];
};
const pas = svg => {
    const jambes = new RegExp(`<rect x="19" y="64" width="9" height="26" rx="4" fill="(${C})"/><rect x="32" y="64" width="9" height="26" rx="4" fill="(${C})"/>` +
        `<ellipse cx="22" cy="91" rx="7" ry="4" fill="(${C})"/><ellipse cx="38" cy="91" rx="7" ry="4" fill="(${C})"/>`);
    return remplacer(svg, [
        [jambes, (_, j1, j2, c1, c2) =>
            `<g transform="rotate(18 23.5 64)"><rect x="19" y="64" width="9" height="26" rx="4" fill="${j1}"/><ellipse cx="22" cy="91" rx="7" ry="4" fill="${c1}"/></g>` +
            `<g transform="translate(0 -4) rotate(-8 36.5 64)"><rect x="32" y="64" width="9" height="26" rx="4" fill="${j2}"/><ellipse cx="38" cy="91" rx="7" ry="4" fill="${c2}"/></g>`],
        ...bras(30, -35)
    ]);
};
// Magicien : bras levé, une étincelle au bout des doigts (lancer un sort).
const sort = svg => {
    const [x, y] = main(49, -160);
    return remplacer(svg, [...bras(15, -160),
        [/<\/g><\/svg>$/, `<path d="M${x + 1} ${y - 9}l2 4.5 4.5 1-3.5 3 1 4.5-4-2.5-4 2.5 1-4.5-3.5-3 4.5-1z" fill="#facc15" stroke="#a16207" stroke-width="1.5"/></g></svg>`]]);
};

// Personnage « sportif » (72×100) : membres en groupes rotate(angle pivot) — jambe g., jambe d., bras g., bras d.
const membres = angles => svg => {
    let i = 0;
    const pivots = ['29 72', '41 72', '16 44', '54 44'];
    const s = svg.replace(/<g transform="rotate\((-?[\d.]+) (29 72|41 72|16 44|54 44)\)">/g, (m, a, p) => {
        i++;
        return angles[pivots.indexOf(p)] === null ? m : `<g transform="rotate(${angles[pivots.indexOf(p)]} ${p})">`;
    });
    if (i !== 4) throw new Error('personnage sportif inattendu');
    return s;
};
// Le ballon (cercle + motif, juste avant </g>) se déplace avec le geste.
const ballon = (dx, dy) => svg => remplacer(svg, [[/(<circle cx="6[01]" cy="(?:90|10)" r="8"[^>]*\/><path d="[^"]*"[^>]*\/>)(<\/g>)/,
    `<g transform="translate(${dx} ${dy})">$1</g>$2`]]);
const enchainer = (...fs) => svg => fs.reduce((s, f) => f(s), svg);
// Raquette (manche + tamis) tournée avec le bras.
const revers = svg => remplacer(membres([null, null, 30, -120])(svg), [[/(<path d="M71 61l6-12"[^>]*\/><ellipse cx="81"[^>]*\/>)/,
    '<g transform="rotate(-75 54 44)">$1</g>']]);

// Marge ajoutée autour d'une pose dont un geste sort du cadre d'origine (le centre de rotation suit : le corps ne bouge pas).
export const MARGES = {marche: 8, sort: 10, tir: 8, dribble: 8, revers: 10};
// Cadre agrandi par translation (un viewBox négatif est mal recentré par l'éditeur de costumes de Scratch).
export const elargir = (svg, m) => {
    if (!m) return svg;
    const [debut, corps, fin] = interieur(svg);
    return debut.replace(/ width="([\d.]+)" height="([\d.]+)" viewBox="0 0 [\d.]+ [\d.]+"/,
        (_, l, h) => ` width="${+l + 2 * m}" height="${+h + 2 * m}" viewBox="0 0 ${+l + 2 * m} ${+h + 2 * m}"`) +
        `<g transform="translate(${m} ${m})">${corps}</g>${fin}`;
};

export const POSES = {
    marche: pas,
    sort,
    tir: enchainer(membres([10, -55, 40, -40]), ballon(3, -12)),
    dribble: enchainer(membres([0, 0, 12, -30]), ballon(4, 74)),
    revers,
    nage: svg => remplacer(svg, [[/M54 23l14-12v24z/, 'M54 23l10-4v8z'], [/M30 12c4 6 4 16 0 22/, 'M33 13c3 6 3 14 0 20']]),
    ailes: svg => remplacer(svg, [[/cx="22" cy="10" rx="12" ry="8"/, 'cx="22" cy="15" rx="12" ry="3.5"'],
        [/cx="36" cy="10" rx="12" ry="8"/, 'cx="36" cy="15" rx="12" ry="3.5"']]),
    envol: svg => remplacer(svg, [[/M40 30 22 8l30 14z/, 'M40 32 16 54l34-14z']]),
    saut: svg => {
        const s = remplacer(svg, [[/<path d="M6 48l-4 6M64 48l4 6" fill="none"\/>/, '']]);
        const [debut, corps, fin] = interieur(s);
        return `${debut}${corps.replace(/^(<g [^>]*>)/, '$1<path d="M10 40 2 54M60 40l8 14" fill="none"/><g transform="translate(0 -6)">')
            .replace(/<\/g>$/, '</g></g>')}${fin}`;
    },
    dandine: svg => envelopper(svg, 'rotate(8 28 72)'),
    clin: svg => remplacer(svg, [
        [new RegExp(`<circle cx="22" cy="28" r="9" fill="${C}"/><circle cx="42" cy="28" r="9" fill="${C}"/>` +
            `<circle cx="22" cy="28" r="4" fill="${C}"/><circle cx="42" cy="28" r="4" fill="${C}"/>`),
        '<path d="M14 28q8 6 16 0M34 28q8 6 16 0" fill="none"/>']]),
    pattes: svg => remplacer(svg, [[/M20 44v6M54 44v6/, 'M17 44l-4 6M57 44l4 6'], [/<circle cx="68" cy="30" r="9"/, '<circle cx="71" cy="29" r="9"'],
        [/<circle cx="71" cy="27" r="2"/, '<circle cx="74" cy="26" r="2"']]),
    flamme: svg => remplacer(svg, [[/M16 54h18l-9 22z/, 'M17 54h16l-8 12z']]),
    reacteur: svg => remplacer(svg, [[/M26 66h18l-9 12z/, 'M28 66h14l-7 6z']]),
    rotor: svg => remplacer(svg, [[/M6 8h70M41 8v10/, 'M24 8h34M41 8v10']]),
    lumieres: svg => remplacer(svg, [[/<circle cx="20" cy="30" r="3"/, '<circle cx="20" cy="30" r="3" opacity=".25"'],
        [/<circle cx="56" cy="30" r="3"/, '<circle cx="56" cy="30" r="3" opacity=".25"']])
};

// ---------- Dessins redessinés (même style : formes pleines, contours arrondis) ----------
const svg = (l, h, contenu) => `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}" viewBox="0 0 ${l} ${h}">${contenu}</svg>`;
const g = (trait, contenu, epais = 3) => `<g stroke="${trait}" stroke-width="${epais}" stroke-linejoin="round" stroke-linecap="round">${contenu}</g>`;
// Liseré clair sous le contour sombre : l'objet se détache sur un fond clair comme sur un fond sombre.
const piece = ([clair, moyen, fonce]) => svg(48, 48,
    '<circle cx="24" cy="24" r="21.5" fill="#ffffff"/>' +
    g(fonce, `<circle cx="24" cy="24" r="19" fill="${moyen}"/><circle cx="24" cy="24" r="12.5" fill="${clair}" stroke-width="2.5"/>`, 3.5) +
    `<path d="M24 16.5v15" stroke="${fonce}" stroke-width="4" stroke-linecap="round"/>` +
    '<path d="M12.5 17a13 13 0 0 1 8-6.5" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".85"/>');
const cle = ([clair, moyen, fonce]) => svg(64, 34,
    '<g fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="17" r="10"/><path d="M27 17h29M48 17v8M56 17v7"/></g>' +
    `<g fill="none" stroke="${fonce}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="17" r="10"/><path d="M27 17h29M48 17v8M56 17v7"/></g>` +
    `<g fill="none" stroke="${moyen}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="17" r="10"/><path d="M27 17h29M48 17v8M56 17v7"/></g>` +
    `<path d="M10 13a8 8 0 0 1 6-5" fill="none" stroke="${clair}" stroke-width="2.5" stroke-linecap="round"/>`);
export const DESSINS = {
    'pièce': {centre: [24, 24], costumes: [
        ['pièce (or)', piece(['#fde68a', '#facc15', '#854d0e'])],
        ['pièce (argent)', piece(['#f1f5f9', '#cbd5e1', '#334155'])],
        ['pièce (bronze)', piece(['#fdba74', '#d97706', '#7c2d12'])]]},
    'clé': {centre: [32, 17], costumes: [
        ['clé (jaune)', cle(['#fef9c3', '#facc15', '#713f12'])],
        ['clé (rouge)', cle(['#fecaca', '#ef4444', '#7f1d1d'])],
        ['clé (bleue)', cle(['#dbeafe', '#3b82f6', '#1e3a8a'])],
        ['clé (verte)', cle(['#dcfce7', '#22c55e', '#14532d'])]]}
};

// ---------- Décors 480×360 ----------
const decor = contenu => svg(480, 360, contenu);
const foule = (y0, rangs, pas = 16) => Array.from({length: rangs}, (_, r) => Array.from({length: Math.ceil(480 / pas) + 1}, (_, i) =>
    `<circle cx="${i * pas + (r % 2) * (pas / 2)}" cy="${y0 + r * 18}" r="6" fill="${['#ef4444', '#facc15', '#3b82f6', '#f97316', '#a855f7', '#22c55e', '#f8fafc'][(i * 3 + r * 5) % 7]}"/>`).join('')).join('');
const arbre = (x, y, c) => `<circle cx="${x}" cy="${y}" r="18" fill="${c}"/><circle cx="${x - 6}" cy="${y - 5}" r="7" fill="#4ade80" opacity=".5"/>`;
const pupitre = x => `<rect x="${x}" y="246" width="110" height="12" rx="3" fill="#b45309"/><rect x="${x + 8}" y="258" width="8" height="40" fill="#78350f"/><rect x="${x + 94}" y="258" width="8" height="40" fill="#78350f"/>` +
    `<rect x="${x + 30}" y="268" width="50" height="8" rx="3" fill="#3b82f6"/><rect x="${x + 34}" y="276" width="6" height="26" fill="#1e3a8a"/><rect x="${x + 70}" y="276" width="6" height="26" fill="#1e3a8a"/><rect x="${x + 70}" y="234" width="6" height="40" rx="3" fill="#3b82f6"/>`;
export const DECORS = {
    'salle de classe': decor('<rect width="480" height="360" fill="#fef3c7"/><rect y="200" width="480" height="8" fill="#fcd34d"/>' +
        '<rect x="110" y="34" width="260" height="140" rx="6" fill="#166534" stroke="#78350f" stroke-width="10"/><rect x="130" y="178" width="220" height="8" rx="3" fill="#a16207"/>' +
        '<rect x="160" y="172" width="22" height="6" rx="2" fill="#ffffff"/><rect x="190" y="172" width="14" height="6" rx="2" fill="#fde047"/>' +
        '<rect x="14" y="40" width="74" height="96" fill="#bae6fd" stroke="#ffffff" stroke-width="7"/><path d="M51 40v96M14 88h74" stroke="#ffffff" stroke-width="5"/><circle cx="34" cy="64" r="9" fill="#fde047"/>' +
        '<circle cx="420" cy="60" r="26" fill="#ffffff" stroke="#334155" stroke-width="5"/><path d="M420 60V44M420 60l10 6" stroke="#334155" stroke-width="4" stroke-linecap="round"/>' +
        '<rect x="392" y="110" width="74" height="10" fill="#92400e"/><rect x="398" y="88" width="14" height="22" fill="#ef4444"/><rect x="414" y="94" width="12" height="16" fill="#3b82f6"/><rect x="428" y="90" width="14" height="20" fill="#22c55e"/><circle cx="454" cy="100" r="10" fill="#38bdf8"/><path d="M448 96q6-6 12 0" fill="none" stroke="#16a34a" stroke-width="3"/>' +
        '<rect y="290" width="480" height="70" fill="#d6a46b"/><path d="M0 312h480M0 336h480" stroke="#b45309" stroke-width="2" opacity=".5"/>' +
        pupitre(30) + pupitre(185) + pupitre(340)),
    'circuit': decor('<rect width="480" height="360" fill="#4ade80"/>' +
        [[30, 30], [450, 40], [40, 330], [440, 320], [240, 180]].map(([x, y]) => arbre(x, y, '#16a34a')).join('') +
        '<ellipse cx="240" cy="180" rx="196" ry="132" fill="none" stroke="#ffffff" stroke-width="86"/>' +
        '<ellipse cx="240" cy="180" rx="196" ry="132" fill="none" stroke="#ef4444" stroke-width="86" stroke-dasharray="14 14"/>' +
        '<ellipse cx="240" cy="180" rx="196" ry="132" fill="none" stroke="#475569" stroke-width="72"/>' +
        '<ellipse cx="240" cy="180" rx="196" ry="132" fill="none" stroke="#f8fafc" stroke-width="3" stroke-dasharray="20 16"/>' +
        Array.from({length: 18}, (_, i) => `<rect x="${i % 2 ? 236 : 244}" y="${276 + i * 4}" width="8" height="4" fill="${i % 2 ? '#111827' : '#ffffff'}"/><rect x="${i % 2 ? 244 : 236}" y="${276 + i * 4}" width="8" height="4" fill="${i % 2 ? '#ffffff' : '#111827'}"/>`).join('') +
        '<rect x="150" y="96" width="180" height="40" rx="6" fill="#94a3b8"/>' +
        Array.from({length: 24}, (_, i) => `<circle cx="${162 + (i % 12) * 14 + Math.floor(i / 12) * 7}" cy="${108 + Math.floor(i / 12) * 16}" r="6" fill="${['#ef4444', '#facc15', '#3b82f6', '#f97316', '#a855f7', '#f8fafc'][(i * 5) % 6]}"/>`).join('')),
    'terrain de basket': decor('<rect width="480" height="360" fill="#cbd5e1"/><rect y="30" width="480" height="110" fill="#64748b"/>' + foule(42, 5) +
        '<rect y="134" width="480" height="8" fill="#334155"/><rect y="142" width="480" height="108" fill="#e2e8f0"/>' +
        [60, 180, 300, 420].map(x => `<rect x="${x - 30}" y="160" width="60" height="34" rx="3" fill="#bae6fd" stroke="#94a3b8" stroke-width="4"/>`).join('') +
        '<rect y="250" width="480" height="110" fill="#f59e0b"/>' + Array.from({length: 5}, (_, i) => `<path d="M0 ${268 + i * 20}h480" stroke="#d97706" stroke-width="2"/>`).join('') +
        '<g fill="none" stroke="#ffffff" stroke-width="4"><path d="M0 262h480M240 250v110"/><ellipse cx="240" cy="305" rx="46" ry="22"/><path d="M0 285h96v60H0M480 285h-96v60h96"/></g>' +
        [[20, 1], [460, -1]].map(([x, s]) => `<rect x="${x - 4}" y="110" width="8" height="150" fill="#475569"/><rect x="${s > 0 ? x + 4 : x - 14}" y="86" width="10" height="64" rx="2" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
            `<path d="M${x + s * 14} 140h${s * 34}" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M${x + s * 16} 142l${s * 6} 20h${s * 18}l${s * 6}-20M${x + s * 22} 152h${s * 24}" fill="none" stroke="#f8fafc" stroke-width="2"/>`).join(''))
};

// ---------- Ambiances ----------
const rvb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hexa = c => `#${c.map(k => Math.max(0, Math.min(255, Math.round(k))).toString(16).padStart(2, '0')).join('')}`;
const melange = (teinte, part, gain = 1) => hex => hexa(rvb(hex).map((k, i) => (k * (1 - part) + teinte[i] * part) * gain));
// Soir : les couleurs claires (ciel) virent à l'orange rosé, les sombres au violet — un coucher de soleil, pas un voile gris.
const soir = hex => {
    const c = rvb(hex), l = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
    const teinte = [0, 1, 2].map(i => [96, 42, 112][i] + ([255, 150, 96][i] - [96, 42, 112][i]) * l);
    return hexa(c.map((k, i) => k * 0.55 + teinte[i] * 0.45));
};
const nuit = melange([10, 16, 52], 0.66);
// Le soleil (grand disque haut dans le ciel) devient la lune la nuit, au lieu d'un disque gris.
const SOLEILS = new Set(['#fde047', '#fb923c', '#f59e0b', '#fef9c3', '#fdba74']);
const estSoleil = attributs => {
    const v = k => Number(attributs.match(new RegExp(` ${k}="([\\d.]+)"`))?.[1] ?? NaN);
    return v('cy') <= 110 && v('r') >= 15;
};
export const AMBIANCES = {
    soir: svgDecor => svgDecor.replace(/#[0-9a-fA-F]{6}\b/g, soir),
    nuit: svgDecor => svgDecor.replace(/<circle([^>]*)fill="#([0-9a-fA-F]{6})"/g,
        (m, a, c) => (SOLEILS.has(`#${c.toLowerCase()}`) && estSoleil(a) ? `<circle${a}fill="§"` : m))
        .replace(/#[0-9a-fA-F]{6}\b/g, nuit).replace(/§/g, '#e2e8f0')
};
