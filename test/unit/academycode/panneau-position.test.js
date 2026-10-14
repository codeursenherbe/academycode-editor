import {borner, lire, ecrire, deplacer, placeLibre, VISIBLE, HAUT_MIN, BANDEAU, MARGE} from '../../../src/lib/academycode/panneau-position.js';

const fenetre = {w: 1280, h: 800};

const stockage = () => {
    const m = new Map();
    return {getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m};
};

describe('position du panneau de consignes', () => {
    test('une position dans la fenêtre ne bouge pas', () => {
        expect(borner({x: 400, y: 200}, 260, fenetre)).toEqual({x: 400, y: 200});
    });

    test('le bandeau reste toujours saisissable', () => {
        expect(borner({x: 5000, y: 5000}, 260, fenetre)).toEqual({x: fenetre.w - VISIBLE, y: fenetre.h - BANDEAU});
        expect(borner({x: -5000, y: -5000}, 260, fenetre)).toEqual({x: VISIBLE - 260, y: HAUT_MIN});
    });

    test('une position mémorisée sur un écran plus grand est ramenée dans un écran plus petit', () => {
        expect(borner({x: 1800, y: 1000}, 260, {w: 1024, h: 700})).toEqual({x: 1024 - VISIBLE, y: 700 - BANDEAU});
    });

    test('mémorisée par leçon, relue telle quelle', () => {
        const s = stockage();
        ecrire(s, '12', {x: 410, y: 130});
        expect(lire(s, '12')).toEqual({x: 410, y: 130});
        expect(lire(s, '13')).toBeNull();
    });

    test('les flèches déplacent de 10 px, Maj + flèches de 50 px ; les autres touches ne déplacent pas', () => {
        expect(deplacer({x: 100, y: 100}, 'ArrowRight', false)).toEqual({x: 110, y: 100});
        expect(deplacer({x: 100, y: 100}, 'ArrowUp', true)).toEqual({x: 100, y: 50});
        expect(deplacer({x: 100, y: 100}, 'Enter', false)).toBeNull();
    });

    test('une valeur abîmée ou un stockage interdit ne cassent rien', () => {
        const s = stockage();
        s.setItem('academycode:consignes:12', '{pas du json');
        expect(lire(s, '12')).toBeNull();
        s.setItem('academycode:consignes:12', JSON.stringify({x: 'a', y: 3}));
        expect(lire(s, '12')).toBeNull();
        const interdit = {getItem: () => { throw new Error('interdit'); }, setItem: () => { throw new Error('plein'); }};
        expect(lire(interdit, '12')).toBeNull();
        expect(() => ecrire(interdit, '12', {x: 1, y: 2})).not.toThrow();
    });
});

// Recette du 14/10/2026 (« Ajouter un score ») : à l'ouverture, le panneau recouvrait le programme repris.
describe('place libre du panneau (sans position choisie par l’enfant)', () => {
    const zone = {left: 312, top: 92, right: 940, bottom: 900};
    const panneau = {x: 320, y: 92, w: 260, h: 330};

    test('sans script, ou si les scripts ne sont pas sous le panneau, la place par défaut reste', () => {
        expect(placeLibre(zone, null, panneau)).toBeNull();
        expect(placeLibre(zone, {left: 620, top: 250, right: 760, bottom: 450}, panneau)).toBeNull();
        expect(placeLibre(zone, {left: 330, top: 500, right: 600, bottom: 700}, panneau)).toBeNull(); // sous le panneau
    });

    test('des scripts sous le panneau : il passe à droite de la zone de code, si c’est libre', () => {
        expect(placeLibre(zone, {left: 330, top: 250, right: 560, bottom: 450}, panneau)).toEqual({x: 940 - 260 - MARGE, y: 92});
    });

    test('pas de côté libre (écran étroit, script large) : la place par défaut reste, l’enfant peut déplacer', () => {
        expect(placeLibre(zone, {left: 330, top: 250, right: 900, bottom: 450}, panneau)).toBeNull();
        expect(placeLibre({...zone, right: 640}, {left: 330, top: 250, right: 400, bottom: 450}, panneau)).toBeNull();
    });
});
