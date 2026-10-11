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

    test('88 sprites, 88 décors (22 scènes × 4 ambiances), comme la sélection', () => {
        expect(catalogue.sprites).toHaveLength(Object.values(selection.sprites).flat().length);
        expect(catalogue.sprites).toHaveLength(88);
        expect(catalogue.backdrops).toHaveLength(88);
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
