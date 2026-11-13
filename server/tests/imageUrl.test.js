const { cleanImageUrl } = require('../utils/imageUrl');

describe('cleanImageUrl', () => {
    const good = 'https://res.cloudinary.com/x/image/upload/v1/q/chemistry/12/1787944637-ab12cd34-eac-4d20-9e99-39dc97173a8a.jpg';

    test('non-breaking spaces around a hyphen inside the address are removed', () => {
        const broken = 'https://res.cloudinary.com/x/image/upload/v1/q/chemistry/12/1787944637-ab12cd34-eac\u00a0-\u00a04d20-9e99-39dc97173a8a.jpg';
        expect(cleanImageUrl(broken)).toBe(good);
    });

    test('zero-width characters are removed', () => {
        expect(cleanImageUrl('https://res.cloudinary.com/x/a\u200bb.jpg')).toBe('https://res.cloudinary.com/x/ab.jpg');
    });

    test('a healthy address is not changed, and non-strings pass through', () => {
        expect(cleanImageUrl(good)).toBe(good);
        expect(cleanImageUrl(undefined)).toBeUndefined();
    });
});
