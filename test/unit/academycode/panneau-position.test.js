import {borner, lire, ecrire, VISIBLE, HAUT_MIN, BANDEAU} from '../../../src/lib/academycode/panneau-position.js';

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
