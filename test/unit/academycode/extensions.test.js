import extensions from '../../../src/lib/libraries/extensions/index.jsx';

test('seules les extensions music et pen restent', () => {
    expect(extensions.map(e => e.extensionId)).toEqual(['music', 'pen']);
});
