// Vérification du comportement (pilote « Programme mystère », étape 2) : la matrice de référence doit être classée à 100 %.
// Moteur réel (scratch-vm du fork, sans rendu). Lancer : node --test test/academycode/comportement.test.mjs
// Les projets de la matrice sont fabriqués par mystere/matrice_gen.py (dessins propres, aucun asset tiers).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {observer, comparer, message} from '../../src/lib/academycode/comportement.mjs';

const {ScratchStorage} = createRequire(import.meta.url)('scratch-storage');
const dossier = new URL('./mystere/', import.meta.url);
const lire = nom => fs.readFileSync(new URL(nom, dossier));
const config = JSON.parse(lire('machine.json'));
const attendus = JSON.parse(lire('manifest.json'));

test('la machine mystère suit ses deux règles (score > niveau × 10 ; 2 + niveau pas par image)', async () => {
    const m = await observer(lire('machine.sb3'), config, new ScratchStorage());
    assert.deepEqual(m.table.map(l => [l.score, l.niveau, l.pasPrincipal]), [
        [0, 1, 3], [9, 1, 3], [10, 1, 3], [11, 2, 4], [20, 2, 4], [21, 3, 5], [30, 3, 5], [31, 4, 6], [40, 4, 6], [41, 5, 7], [51, 6, 8]
    ]);
});

test('la matrice de référence est classée à 100 % (justes, faux typiques, cas impossibles)', async () => {
    const machine = await observer(lire('machine.sb3'), config, new ScratchStorage());
    for (const [nom, attendu] of Object.entries(attendus)) {
        const r = comparer(machine, await observer(lire(`${nom}.sb3`), config, new ScratchStorage()));
        assert.equal(r.verdict, attendu, `${nom} : ${message(r, config)}`);
    }
});

test('deux passages donnent le même classement (pas d’horloge réelle)', async () => {
    const machine = await observer(lire('machine.sb3'), config, new ScratchStorage());
    const fois = async () => Promise.all(Object.keys(attendus).map(async n =>
        comparer(machine, await observer(lire(`${n}.sb3`), config, new ScratchStorage())).verdict));
    assert.deepEqual(await fois(), await fois());
});

test('les messages disent ce qui a été observé, sans la règle, et jamais « correct »', async () => {
    const machine = await observer(lire('machine.sb3'), config, new ScratchStorage());
    const textes = await Promise.all(Object.keys(attendus).map(async n =>
        message(comparer(machine, await observer(lire(`${n}.sb3`), config, new ScratchStorage())), config)));
    for (const t of textes) {
        assert.doesNotMatch(t, /× ?10|\* ?10|2 \+ niveau|correct/i);
    }
    assert.match(textes[0], /situations testées/);
});

test('l’horloge de la page est rendue après le test, même en cas d’erreur', async () => {
    const avant = Date.now;
    await observer(Buffer.from('pas un projet'), config, new ScratchStorage());
    await observer(lire('juste-5-clones-attentes-hasard.sb3'), config, new ScratchStorage());
    assert.equal(Date.now, avant);
});
