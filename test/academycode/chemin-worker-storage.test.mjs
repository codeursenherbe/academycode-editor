// Chemin du worker de scratch-storage (correctif L0 bis, 11/10/2026) : le loader doit trouver le chemin public figé
// une seule fois dans le vrai fichier livré, et le worker visé doit exister dans le paquet (copié dans chunks/).
// Lancer : node --test test/academycode/chemin-worker-storage.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const loader = require('../../scripts/chemin-worker-storage.js');
const fichier = require.resolve('scratch-storage/dist/web/scratch-storage.js');
const source = fs.readFileSync(fichier, 'utf8');

test('le chemin public figé est remplacé, une seule fois', () => {
    const sortie = loader(source);
    assert.ok(!sortie.includes(loader.MOTIF));
    assert.equal(sortie.split('__webpack_require__.p = "";').length - 1, 1);
});

test('le worker cherché est bien livré par scratch-storage', () => {
    const nom = source.match(/"chunks\/" \+ "fetch-worker" \+ "\." \+ "([0-9a-f]+)" \+ "\.js"/);
    assert.ok(nom, 'nom du worker introuvable dans scratch-storage');
    assert.ok(fs.existsSync(require.resolve(`scratch-storage/dist/web/chunks/fetch-worker.${nom[1]}.js`)));
});

test('un motif absent fait échouer le build plutôt qu\'une régression silencieuse', () => {
    assert.throws(() => loader('// rien'), /0 occurrence/);
});
