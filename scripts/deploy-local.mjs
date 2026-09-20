// Copie build/ (sans cartes source) dans public/editeur/ d'AcademyCode en conservant son .htaccess.
import {cpSync, existsSync, readdirSync, rmSync} from 'node:fs';

const target = process.argv[2] ?? '../academycode/public/editeur';
if (!existsSync(target)) throw new Error(`Dossier introuvable : ${target}`);
for (const entry of readdirSync(target)) {
    if (entry !== '.htaccess') rmSync(`${target}/${entry}`, {recursive: true, force: true});
}
cpSync('build', target, {recursive: true, filter: source => !source.endsWith('.map')});
console.log(`Éditeur déployé dans ${target}`);
