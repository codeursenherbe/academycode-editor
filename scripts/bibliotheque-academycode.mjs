// Bibliothèque enrichie d'AcademyCode (lot L8, 11/10/2026) : construit bibliotheque-academycode/catalogue.json et copie
// les dessins retenus dans bibliotheque-academycode/assets/, à partir de la bibliothèque générée par l'Espace
// Animateurs (dessins originaux Codeurs en Herbe) et de la sélection bibliotheque-academycode/selection.json.
//   node scripts/bibliotheque-academycode.mjs C:/Dev/espace-animateurs/public/editeur/static
// Lecture seule de l'Espace. Les fichiers produits sont versionnés : le build ne dépend pas du dépôt de l'Espace.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Dossier static de l\'Espace attendu (…/public/editeur/static)');
const RACINE = path.resolve(import.meta.dirname, '../bibliotheque-academycode');
const sel = JSON.parse(fs.readFileSync(path.join(RACINE, 'selection.json'), 'utf8'));
const ceh = JSON.parse(fs.readFileSync(path.join(source, 'bibliotheque-ceh.json'), 'utf8'));
const nom = n => sel.noms[n] ?? n;

const sprites = [];
for (const [tag, noms] of Object.entries(sel.sprites)) {
    for (const n of noms) {
        const s = ceh.sprites.find(x => x.name === n);
        if (!s) throw new Error(`sprite introuvable : ${n}`);
        sprites.push({...s,
            name: nom(n),
            tags: [tag],
            costumes: s.costumes.map(c => ({...c, name: nom(c.name)}))});
    }
}
const backdrops = [];
for (const [tag, noms] of Object.entries(sel.decors)) {
    for (const n of noms) {
        const ambiances = ceh.backdrops.filter(d => d.name === n || d.name.startsWith(`${n} (`));
        if (!ambiances.length) throw new Error(`décor introuvable : ${n}`);
        for (const d of ambiances) backdrops.push({...d, tags: [tag]});
    }
}
const costumes = sprites.flatMap(s => s.costumes.map(c => ({...c, tags: s.tags})));

const fichiers = new Set([...sprites.flatMap(s => s.costumes.map(c => c.md5ext)), ...backdrops.map(d => d.md5ext)]);
const dossier = path.join(RACINE, 'assets');
fs.rmSync(dossier, {recursive: true, force: true});
fs.mkdirSync(dossier, {recursive: true});
let octets = 0;
for (const f of fichiers) {
    fs.copyFileSync(path.join(source, 'lib-assets', f), path.join(dossier, f));
    octets += fs.statSync(path.join(dossier, f)).size;
}
let commit = 'inconnu';
try {
    commit = execFileSync('git', ['-C', source, 'rev-parse', '--short=9', 'HEAD']).toString()
        .trim();
} catch (e) {
    // source hors dépôt Git
}
const catalogue = {
    source: `Espace Animateurs ${commit} (dessins originaux Codeurs en Herbe, générés par scripts/scratch/)`,
    etiquettes: sel.etiquettes,
    existants: sel.existants,
    sprites,
    backdrops,
    costumes
};
fs.writeFileSync(path.join(RACINE, 'catalogue.json'), `${JSON.stringify(catalogue)}\n`);
const ko = n => (n / 1024).toFixed(0);
console.log(`${sprites.length} sprites, ${backdrops.length} décors, ${costumes.length} costumes ; ` +
    `${fichiers.size} fichiers, ${ko(octets)} Ko ; ` +
    `catalogue ${ko(fs.statSync(path.join(RACINE, 'catalogue.json')).size)} Ko`);
