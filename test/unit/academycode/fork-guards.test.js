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
