const selection = require('../../../selection.json');

const names = library => require(`../../../src/lib/libraries/${library}.json`).map(item => item.name).sort();

test('les bibliothèques ne contiennent que la sélection', () => {
    expect(names('sprites')).toEqual([...selection.sprites].sort());
    expect(names('backdrops')).toEqual([...selection.backdrops].sort());
    expect(names('sounds')).toEqual([...selection.sounds].sort());
});

test('la bibliothèque de costumes ne garde que ceux des sprites retenus', () => {
    const wanted = new Set();
    require('../../../src/lib/libraries/sprites.json').forEach(sprite => {
        sprite.costumes.forEach(costume => wanted.add(costume.md5ext));
    });
    require('../../../src/lib/libraries/costumes.json').forEach(costume => {
        expect(wanted.has(costume.md5ext)).toBe(true);
    });
});
