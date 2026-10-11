import fs from 'fs';
import path from 'path';
import {fusionner, categories} from '../../../src/lib/academycode/bibliotheque-academycode.jsx';
import sprites from '../../../src/lib/libraries/sprites.json';
import backdrops from '../../../src/lib/libraries/backdrops.json';
import sounds from '../../../src/lib/libraries/sounds.json';

const RACINE = path.join(__dirname, '../../../bibliotheque-academycode');
const catalogue = JSON.parse(fs.readFileSync(path.join(RACINE, 'catalogue.json'), 'utf8'));
const selection = JSON.parse(fs.readFileSync(path.join(RACINE, 'selection.json'), 'utf8'));

describe('bibliothèque enrichie d\'AcademyCode : fusion', () => {
    const cat = {
        etiquettes: {animaux: 'Animaux', objets: 'Objets', sports: 'Sports et jeux'},
        existants: {Cat: ['animaux']},
        sprites: [{name: 'chien', tags: ['animaux']}, {name: 'clé', tags: ['objets']}]
    };

    test('les éléments d\'origine restent en tête, inchangés hors étiquettes', () => {
        const origine = [{name: 'Cat', tags: ['animals'], md5: 'a'}, {name: 'Ball', tags: ['sports']}];
        const d = fusionner(origine, cat, 'sprites');
        expect(d.map(e => e.name)).toEqual(['Cat', 'Ball', 'chien', 'clé']);
        expect(d[0]).toEqual({name: 'Cat', tags: ['animals', 'animaux'], md5: 'a'});
        expect(origine[0].tags).toEqual(['animals']); // la bibliothèque d'origine n'est pas modifiée
    });

    test('catalogue absent (réseau coupé) : la bibliothèque d\'origine, comme avant', () => {
        const origine = [{name: 'Cat', tags: ['animals']}];
        expect(fusionner(origine, null, 'sprites')).toBe(origine);
        expect(categories(null, origine, ['animals'])).toEqual(['animals']);
    });

    test('seules les catégories présentes sont proposées, dans l\'ordre du catalogue', () => {
        const d = fusionner([{name: 'Cat', tags: []}], cat, 'sprites');
        expect(categories(cat, d, []).map(c => c.tag)).toEqual(['animaux', 'objets']);
    });
});

describe('bibliothèque enrichie d\'AcademyCode : catalogue', () => {
    const origine = new Set([...sprites, ...backdrops, ...sounds].map(e => e.name));
    const etiquettes = Object.keys(catalogue.etiquettes);

    test('82 sprites, 56 décors (25 lieux, ambiances seulement là où elles ont un sens), comme la sélection', () => {
        expect(catalogue.sprites).toHaveLength(Object.values(selection.sprites).flat().length);
        expect(catalogue.sprites).toHaveLength(82);
        expect(catalogue.backdrops).toHaveLength(56);
        const lieux = Object.values(selection.decors).flat();
        expect(lieux).toHaveLength(25);
        expect(catalogue.backdrops.map(d => d.name)).toEqual(expect.arrayContaining(['salle de classe', 'circuit',
            'terrain de basket', 'forêt (soir)', 'forêt (nuit)', 'chambre enfant (nuit)']));
        expect(catalogue.backdrops.map(d => d.name).filter(n => /\(aube\)/.test(n))).toEqual([]);
    });

    test('aucun doublon d\'image ; doublons de Scratch retirés', () => {
        const md5 = [...catalogue.sprites.flatMap(s => s.costumes), ...catalogue.backdrops].map(c => c.md5ext);
        expect(new Set(md5).size).toBe(md5.length);
        const noms = catalogue.sprites.map(s => s.name);
        for (const n of ['chat', 'chien', 'papillon', 'fantôme', 'banane', 'étoile bonus', 'ballon']) {
            expect(noms).not.toContain(n);
        }
        expect(noms).toContain('ballon de foot');
    });

    test('une 2e pose « b » après chaque couleur des sprites qui bougent', () => {
        for (const n of Object.keys(selection.poses)) {
            const c = catalogue.sprites.find(s => s.name === n).costumes.map(x => x.name);
            expect(c).toHaveLength(8);
            expect(c.slice(0, 4)).toEqual([n, `${n} b`, `${n} (couleur 2)`, `${n} b (couleur 2)`]);
        }
    });

    test('pièce et clé redessinées, en plusieurs couleurs', () => {
        const c = n => catalogue.sprites.find(s => s.name === n).costumes.map(x => x.name);
        expect(c('pièce')).toEqual(['pièce (or)', 'pièce (argent)', 'pièce (bronze)']);
        expect(c('clé')).toHaveLength(4);
    });

    test('chaque dessin est livré, et nommé par son empreinte', () => {
        const fichiers = new Set(fs.readdirSync(path.join(RACINE, 'assets')));
        const md5 = [...catalogue.sprites.flatMap(s => s.costumes), ...catalogue.backdrops, ...catalogue.costumes].map(c => c.md5ext);
        expect(md5.filter(m => !fichiers.has(m))).toEqual([]);
        expect(md5.every(m => /^[0-9a-f]{32}\.svg$/.test(m))).toBe(true);
    });

    test('aucun nom en double, aucun conflit avec les éléments d\'origine que les leçons citent', () => {
        const noms = [...catalogue.sprites, ...catalogue.backdrops].map(e => e.name);
        expect(new Set(noms).size).toBe(noms.length);
        expect(noms.filter(n => origine.has(n))).toEqual([]);
    });

    test('catégories valides partout, éléments d\'origine rangés', () => {
        for (const e of [...catalogue.sprites, ...catalogue.backdrops, ...catalogue.costumes]) {
            expect(e.tags.every(t => etiquettes.includes(t))).toBe(true);
        }
        for (const [n, tags] of Object.entries(catalogue.existants)) {
            expect(origine.has(n)).toBe(true);
            expect(tags.every(t => etiquettes.includes(t))).toBe(true);
        }
    });

    test('noms affichés corrigés et provenance indiquée', () => {
        expect(catalogue.sprites.map(s => s.name)).toContain('pièce');
        expect(catalogue.sprites.map(s => s.name)).not.toContain('piece');
        expect(catalogue.source).toMatch(/Codeurs en Herbe/);
    });
});
