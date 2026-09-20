// Filtre les bibliothèques sur selection.json (idempotent) et télécharge les assets retenus
// dans static/lib-assets/ (servis ensuite par AcademyCode, jamais par les serveurs Scratch à l'exécution).
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync} from 'node:fs';

const LIB = 'src/lib/libraries';
const OUT = 'static/lib-assets';
const selection = JSON.parse(readFileSync('selection.json', 'utf8'));
const read = name => JSON.parse(readFileSync(`${LIB}/${name}.json`, 'utf8'));
const write = (name, data) => writeFileSync(`${LIB}/${name}.json`, `${JSON.stringify(data, null, 4)}\n`);

const pick = (items, names, kind) => names.map(name => {
    const item = items.find(i => i.name === name);
    if (!item) throw new Error(`${kind} introuvable dans la bibliothèque : ${name}`);
    return item;
});

const sprites = pick(read('sprites'), selection.sprites, 'sprite');
const backdrops = pick(read('backdrops'), selection.backdrops, 'décor');
const sounds = pick(read('sounds'), selection.sounds, 'son');

const md5 = new Set();
sprites.forEach(sprite => {
    sprite.costumes.forEach(costume => md5.add(costume.md5ext));
    (sprite.sounds || []).forEach(sound => md5.add(sound.md5ext));
});
backdrops.forEach(item => md5.add(item.md5ext));
sounds.forEach(item => md5.add(item.md5ext));
const costumes = read('costumes').filter(costume => md5.has(costume.md5ext));

write('sprites', sprites);
write('backdrops', backdrops);
write('sounds', sounds);
write('costumes', costumes);

mkdirSync(OUT, {recursive: true});
let bytes = 0;
for (const file of md5) {
    const target = `${OUT}/${file}`;
    if (!existsSync(target)) {
        const response = await fetch(`https://assets.scratch.mit.edu/internalapi/asset/${file}/get/`);
        if (!response.ok) throw new Error(`Téléchargement impossible : ${file} (${response.status})`);
        writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    }
    bytes += statSync(target).size;
}
console.log(`${md5.size} assets, ${(bytes / 1048576).toFixed(1)} Mo dans ${OUT}`);
