import {disponible, actif, basculer, sortir} from '../../../src/lib/academycode/plein-ecran.js';

const doc = ({standard = false, webkit = false, plein = null} = {}) => {
    const appels = [];
    const el = {};
    const d = {documentElement: el, appels};
    if (standard) {
        d.fullscreenEnabled = true;
        d.fullscreenElement = plein;
        el.requestFullscreen = function () { appels.push(['entrer', this === el]); };
        d.exitFullscreen = function () { appels.push(['sortir', this === d]); };
    }
    if (webkit) {
        d.webkitFullscreenEnabled = true;
        d.webkitFullscreenElement = plein;
        el.webkitRequestFullscreen = function () { appels.push(['entrer webkit', this === el]); };
        d.webkitExitFullscreen = function () { appels.push(['sortir webkit', this === d]); };
    }
    return d;
};

describe('plein écran de l\'éditeur', () => {
    test('API standard : entrer puis sortir', () => {
        const d = doc({standard: true});
        expect(disponible(d)).toBe(true);
        basculer(d);
        expect(d.appels).toEqual([['entrer', true]]);
        d.fullscreenElement = d.documentElement;
        expect(actif(d)).toBe(true);
        basculer(d);
        expect(d.appels[1]).toEqual(['sortir', true]);
    });

    test('ancien Safari d\'iPad : API préfixée webkit', () => {
        const d = doc({webkit: true});
        expect(disponible(d)).toBe(true);
        basculer(d);
        expect(d.appels).toEqual([['entrer webkit', true]]);
        d.webkitFullscreenElement = d.documentElement;
        sortir(d);
        expect(d.appels[1]).toEqual(['sortir webkit', true]);
    });

    test('sans API : bouton non proposé, et sortir ne fait rien', () => {
        const d = doc();
        expect(disponible(d)).toBe(false);
        expect(actif(d)).toBe(false);
        expect(() => sortir(d)).not.toThrow();
    });

    test('plein écran interdit par la page (iframe sans allowfullscreen) : non proposé', () => {
        const d = doc({standard: true});
        d.fullscreenEnabled = false;
        expect(disponible(d)).toBe(false);
    });
});
