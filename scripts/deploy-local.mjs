// Copie build/ (sans cartes source) dans public/editeur/ d'AcademyCode en conservant son .htaccess.
import {cpSync, existsSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {execSync} from 'node:child_process';

const target = process.argv[2] ?? '../academycode/public/editeur';
if (!existsSync(target)) throw new Error(`Dossier introuvable : ${target}`);
for (const entry of readdirSync(target)) {
    if (entry !== '.htaccess') rmSync(`${target}/${entry}`, {recursive: true, force: true});
}
cpSync('build', target, {recursive: true, filter: source => !source.endsWith('.map')});

// AGPL-3.0 : le lien « code source » d'AcademyCode doit désigner la version réellement
// déployée. On écrit le commit à côté du build plutôt que de compter sur une mise à jour
// manuelle, qui se désynchronise au premier déploiement oublié.
const commit = execSync('git rev-parse --short=9 HEAD').toString().trim();
const propre = execSync('git status --porcelain').toString().trim() === '';
writeFileSync(`${target}/VERSION`, `${commit}${propre ? '' : ' (build depuis un dépôt modifié)'}
`);

console.log(`Éditeur déployé dans ${target} (commit ${commit}${propre ? '' : ', dépôt modifié'})`);
