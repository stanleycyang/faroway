import { usableDestinationImages } from '../../lib/destinationCatalog';
const collection = [{ name: 'Paris', country: 'France', image: 'https://images.test/paris.jpg' }];
it('repairs missing art only for a matching city and country', () => {
  expect(
    usableDestinationImages([{ name: ' PARIS ', country: 'france', image: '' }], collection)[0]
      .image
  ).toBe(collection[0].image);
  expect(
    usableDestinationImages([{ name: 'Paris', country: 'USA', image: '' }], collection)
  ).toEqual([]);
});
it('does not replace a populated collection with image-less fixtures', () => {
  expect(
    usableDestinationImages(
      [{ name: 'Fixture Harbor', country: 'Testland', image: '' }],
      collection
    )
  ).toEqual([]);
});
it('preserves supplied photos and filters unsafe or malformed sources', () => {
  expect(
    usableDestinationImages(
      [{ name: 'Unknown', country: 'Country', image: ' https://images.test/new.jpg ' }],
      collection
    )[0].image
  ).toBe('https://images.test/new.jpg');
  for (const image of ['http://images.test/plain.jpg', '/relative.jpg', '   ', 'not a url']) {
    expect(
      usableDestinationImages([{ name: 'Unknown', country: 'Country', image }], collection)
    ).toEqual([]);
  }
});
