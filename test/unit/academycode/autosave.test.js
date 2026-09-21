import AutoSaver from '../../../src/lib/academycode/autosave.js';

// Le minuteur est injecté : on déclenche les ticks à la main, sans horloge factice.
const makeSaver = (save, onError = jest.fn()) => {
    const ticks = [];
    const saver = new AutoSaver({
        save,
        onError,
        periodMs: 30000,
        setTimer: fn => {
            ticks.push(fn);
            return ticks.length;
        },
        clearTimer: jest.fn()
    });
    saver.start();
    return {saver, tick: () => ticks[0](), onError};
};

test('ne sauvegarde rien tant que le projet n\'est pas modifié', async () => {
    const save = jest.fn(() => Promise.resolve({saved: true}));
    const {tick} = makeSaver(save);
    await tick();
    expect(save).not.toHaveBeenCalled();
});

test('sauvegarde à chaque période si le projet est modifié, pas davantage', async () => {
    const save = jest.fn(() => Promise.resolve({saved: true}));
    const {saver, tick} = makeSaver(save);
    saver.markDirty();
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    await tick();
    expect(save).toHaveBeenCalledTimes(1);
    saver.markDirty();
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
});

test('une erreur remet le projet à sauvegarder, prévient, et la période suivante réessaie', async () => {
    const save = (() => {
        let call = 0;
        return jest.fn(() => (++call === 1 ?
            Promise.reject(new Error('réseau')) :
            Promise.resolve({saved: true})));
    })();
    const {saver, tick, onError} = makeSaver(save);
    saver.markDirty();
    await tick();
    expect(onError).toHaveBeenCalledTimes(1);
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
});

test('flush attend la sauvegarde en cours au lieu de la doubler', async () => {
    let release;
    const save = jest.fn(() => new Promise(resolve => {
        release = () => resolve({saved: true});
    }));
    const {saver} = makeSaver(save);
    saver.markDirty();
    const first = saver.flush();
    const second = saver.flush();
    release();
    await first;
    await second;
    expect(save).toHaveBeenCalledTimes(1);
});

test('flush(true) sauvegarde même sans modification et renvoie le résultat', async () => {
    const save = jest.fn(() => Promise.resolve({saved: true, message: 'ok'}));
    const {saver} = makeSaver(save);
    await expect(saver.flush(true)).resolves.toEqual({saved: true, message: 'ok'});
});

test('flush(true) propage l\'erreur à l\'appelant (bouton Vérifier)', async () => {
    const save = jest.fn(() => Promise.reject(new Error('Trop lourd')));
    const {saver} = makeSaver(save);
    // Jest 21 : `rejects` ne se combine pas avec `toThrow`, on inspecte l'erreur à la main.
    await saver.flush(true).then(
        () => { throw new Error('flush aurait dû échouer'); },
        error => expect(error.message).toBe('Trop lourd')
    );
});

// Scénario réel de la recette : coupure réseau, l'enfant ne touche plus à rien,
// puis le réseau revient. La sauvegarde doit repartir seule, sans nouvelle modification.
test('apres une coupure, le retour du reseau suffit a sauvegarder sans nouvelle modification', async () => {
    let online = false;
    const save = jest.fn(() => (online ? Promise.resolve({saved: true}) : Promise.reject(new Error('réseau'))));
    const {saver, tick, onError} = makeSaver(save);
    saver.markDirty();
    await tick();
    expect(onError).toHaveBeenCalledTimes(1);
    online = true;
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
});

// Régression : les minuteurs par défaut doivent fonctionner tels quels. Détachés de window,
// setInterval lève « Illegal invocation » et l'auto-sauvegarde ne démarre jamais — ce que les
// tests ne voyaient pas, puisqu'ils injectent tous un faux minuteur.
test('start() fonctionne avec les minuteurs natifs, sans injection', () => {
    const saver = new AutoSaver({save: () => Promise.resolve({saved: true}), periodMs: 10000});
    expect(() => saver.start()).not.toThrow();
    saver.stop();
});
