const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, '..', '..', '..', file), 'utf8');

test('les assets ne viennent plus des serveurs Scratch', () => {
    expect(read('src/lib/storage.js')).not.toMatch(/internalapi/);
    expect(read('src/lib/project-fetcher-hoc.jsx')).not.toMatch(/scratch\.mit\.edu/);
    expect(read('src/containers/library-item.jsx')).not.toMatch(/scratch\.mit\.edu/);
});

test('le menu ne propose ni chargement, ni export, ni tutoriels, ni debug', () => {
    const menu = read('src/components/menu-bar/menu-bar.jsx');
    ['onStartSelectingFileUpload', 'SB3Downloader', 'tutorials-button', 'onOpenDebugModal'].forEach(text => {
        expect(menu).not.toContain(text);
    });
});

test('le point d\'entrée n\'a ni logo cliquable, ni sac à dos, ni confirmation de fermeture', () => {
    const entry = read('src/playground/render-gui.jsx');
    ['onClickLogo', 'backpackVisible', 'showComingSoon', 'onbeforeunload'].forEach(text => {
        expect(entry).not.toContain(text);
    });
});

test('une sauvegarde automatique refusée affiche le motif donné par le serveur, pas « connexion coupée »', () => {
    // Trouvé lors des parcours simulés du 09/10 : au quota de la semaine atteint, le serveur répond 409 avec son message ;
    // la sauvegarde automatique suivante l'écrasait par « La connexion est coupée, on réessaie tout seul ».
    const bridge = read('src/lib/academycode/bridge-hoc.jsx');
    expect(bridge).toMatch(/onError: error => this\.setState\(\{message: error\.message \|\| NETWORK_MESSAGE\}\)/);
});

test('l\'atelier porte l\'identité AcademyCode, pas celle de Scratch (D1-a, D1-b du 15/10/2026)', () => {
    // favicon : celui du site AcademyCode (le Scratch Cat est une marque de la Scratch Foundation)
    const favicon = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'static', 'favicon.ico'));
    expect(require('crypto').createHash('sha256').update(favicon).digest('hex').slice(0, 16)).toBe('67fe3e76fda27985');
    expect(read('webpack.config.js')).not.toMatch(/Scratch 3\.0 GUI/);
    expect(read('src/lib/titled-hoc.jsx')).toContain('defaultMessage: \'Mon projet\'');
    const logo = read('src/components/menu-bar/scratch-logo.svg');
    expect(logo).toContain('aria-label="AcademyCode"');
    expect(read('src/components/menu-bar/menu-bar.jsx')).not.toContain('alt="Scratch"');
    // logos des modes cachés (dont un Scratch Cat) : plus dans le paquet
    expect(read('src/components/menu-bar/menu-bar.jsx')).not.toMatch(/cat_logo|nineties_logo|prehistoric-logo|oldtimey-logo/);
    // tutoriels : plus aucune image livrée ; les catégories restent pour la bibliothèque de sprites
    const decks = path.join(__dirname, '..', '..', '..', 'src', 'lib', 'libraries', 'decks');
    expect(fs.readdirSync(decks).sort()).toEqual(['index.jsx', 'translate-image.js', 'translate-video.js']);
    expect(read('src/lib/libraries/decks/index.jsx')).toContain('export default {};');
});
