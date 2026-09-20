# academycode-editor

Fork de [scratch-gui](https://github.com/scratchfoundation/scratch-gui) (licence AGPL-3.0, voir `LICENSE`) pour l'atelier Scratch d'AcademyCode.
Le code source de cette version modifiée doit rester offert aux utilisateurs de l'éditeur (AGPL, article 13).
Nom et logo Scratch : voir `TRADEMARK` ; ce fork n'est pas Scratch et n'est pas affilié à la Scratch Foundation.

## Modifications par rapport à l'amont

- Extensions : seules `music` et `pen` restent.
- Bibliothèques (sprites, décors, sons, costumes) réduites à `selection.json`, assets servis par AcademyCode (`/editeur/static/lib-assets/`), aucun appel à `scratch.mit.edu`.
- Menu Fichier : « Nouveau » seulement. Pas de Tutoriels, de Debug, de sac à dos, de logo cliquable, ni de confirmation de fermeture.
- Pont AcademyCode (`src/lib/academycode/`) : chargement et sauvegarde du projet sur AcademyCode, auto-sauvegarde toutes les 30 s, bouton « Vérifier mon projet ».

## Construire et déployer

```bash
npm ci --ignore-scripts --no-audit --no-fund
node scripts/prepublish.mjs
npm run assets          # filtre les bibliothèques et télécharge les assets retenus
npm run build
npm run deploy:local    # copie build/ (sans .map) dans ../academycode/public/editeur/
```

En production : envoyer le contenu de `build/` (hors `.map`) par FTP dans `public/editeur/` d'AcademyCode, sans écraser `.htaccess`.

## Mise à jour depuis l'amont

`git fetch upstream && git merge upstream/develop`, puis refaire `npm run assets`, `npm run test:unit` et la recette de la tâche 15 du plan. Les fichiers `src/lib/libraries/*.json` sont volontairement filtrés : attendre des conflits à cet endroit.
