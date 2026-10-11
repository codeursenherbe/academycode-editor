// Bibliothèque enrichie d'AcademyCode (lot L8, 11/10/2026) : construit bibliotheque-academycode/catalogue.json et
// bibliotheque-academycode/assets/, à partir de la bibliothèque générée par l'Espace Animateurs (dessins originaux
// Codeurs en Herbe), de la sélection bibliotheque-academycode/selection.json et des finitions AcademyCode
// (scripts/bibliotheque-academycode-dessins.mjs : poses, pièce et clé, décors ajoutés, ambiances soir et nuit).
//   node scripts/bibliotheque-academycode.mjs C:/Dev/espace-animateurs/public/editeur/static
// Lecture seule de l'Espace. Les fichiers produits sont versionnés : le build ne dépend pas du dépôt de l'Espace.
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {AMBIANCES, DECORS, DESSINS, MARGES, POSES, elargir} from './bibliotheque-academycode-dessins.mjs';

const source = process.argv[2];
if (!source) throw new Error('Dossier static de l\'Espace attendu (…/public/editeur/static)');
const RACINE = path.resolve(import.meta.dirname, '../bibliotheque-academycode');
const sel = JSON.parse(fs.readFileSync(path.join(RACINE, 'selection.json'), 'utf8'));
const ceh = JSON.parse(fs.readFileSync(path.join(source, 'bibliotheque-ceh.json'), 'utf8'));
const nom = n => sel.noms[n] ?? n;

const dossier = path.join(RACINE, 'assets');
fs.rmSync(dossier, {recursive: true, force: true});
fs.mkdirSync(dossier, {recursive: true});
let octets = 0;
const lire = md5ext => fs.readFileSync(path.join(source, 'lib-assets', md5ext), 'utf8');
// Écrit un dessin sous son empreinte (comme Scratch) et rend la description de costume.
const costume = (nomCostume, contenu, [x, y]) => {
    const assetId = crypto.createHash('md5').update(contenu)
        .digest('hex');
    const fichier = path.join(dossier, `${assetId}.svg`);
    if (!fs.existsSync(fichier)) {
        fs.writeFileSync(fichier, contenu);
        octets += contenu.length;
    }
    return {assetId, name: nomCostume, bitmapResolution: 1, md5ext: `${assetId}.svg`, dataFormat: 'svg',
        rotationCenterX: x, rotationCenterY: y};
};

const sprites = [];
for (const [tag, noms] of Object.entries(sel.sprites)) {
    for (const n of noms) {
        const affiche = nom(n);
        const dessin = DESSINS[affiche];
        const s = ceh.sprites.find(x => x.name === n);
        if (!s && !dessin) throw new Error(`sprite introuvable : ${n}`);
        let costumes;
        if (dessin) {
            costumes = dessin.costumes.map(([c, contenu]) => costume(c, contenu, dessin.centre));
        } else {
            const pose = sel.poses[n] && POSES[sel.poses[n]];
            if (sel.poses[n] && !pose) throw new Error(`pose inconnue : ${sel.poses[n]}`);
            // Avec une pose : chaque couleur donne deux costumes (« x », « x b »), dans l'ordre d'animation.
            costumes = s.costumes.flatMap(c => {
                const centre = [c.rotationCenterX, c.rotationCenterY];
                const nomC = nom(c.name);
                const a = costume(nomC, lire(c.md5ext), centre);
                if (!pose) return [a];
                const m = MARGES[sel.poses[n]] ?? 0;
                const b = elargir(pose(lire(c.md5ext)), m);
                if (m && b === pose(lire(c.md5ext))) throw new Error(`cadre inattendu : ${n}`);
                return [a, costume(nomC.replace(/^(.*?)( \(couleur \d\))?$/, '$1 b$2'), b, centre.map(k => k + m))];
            });
        }
        sprites.push({name: affiche, tags: [tag], isStage: false, variables: {}, costumes,
            sounds: s?.sounds ?? [], blocks: s?.blocks ?? {}});
    }
}
const backdrops = [];
for (const [tag, noms] of Object.entries(sel.decors)) {
    for (const n of noms) {
        const d = ceh.backdrops.find(x => x.name === n);
        const jour = DECORS[n] ?? (d && lire(d.md5ext));
        if (!jour) throw new Error(`décor introuvable : ${n}`);
        backdrops.push({...costume(n, jour, [240, 180]), tags: [tag]});
        for (const a of sel.ambiances[n] ?? []) {
            backdrops.push({...costume(`${n} (${a})`, AMBIANCES[a](jour), [240, 180]), tags: [tag]});
        }
    }
}
const costumes = sprites.flatMap(s => s.costumes.map(c => ({...c, tags: s.tags})));

let commit = 'inconnu';
try {
    commit = execFileSync('git', ['-C', source, 'rev-parse', '--short=9', 'HEAD']).toString()
        .trim();
} catch (e) {
    // source hors dépôt Git
}
const catalogue = {
    source: `Espace Animateurs ${commit} (dessins originaux Codeurs en Herbe, générés par scripts/scratch/) ` +
        'et finitions AcademyCode (scripts/bibliotheque-academycode-dessins.mjs)',
    etiquettes: sel.etiquettes,
    existants: sel.existants,
    sprites,
    backdrops,
    costumes
};
fs.writeFileSync(path.join(RACINE, 'catalogue.json'), `${JSON.stringify(catalogue)}\n`);
const ko = n => (n / 1024).toFixed(0);
console.log(`${sprites.length} sprites (${sprites.filter(s => s.costumes.some(c => / b( \(|$)/.test(c.name))).length} ` +
    `avec 2 poses), ${backdrops.length} décors, ${costumes.length} costumes ; ` +
    `${fs.readdirSync(dossier).length} fichiers, ${ko(octets)} Ko ; ` +
    `catalogue ${ko(fs.statSync(path.join(RACINE, 'catalogue.json')).size)} Ko`);
