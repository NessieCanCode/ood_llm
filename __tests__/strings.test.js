const { titleCase } = require('../utils/strings');

describe('titleCase', () => {
  test('converts words to title case', () => {
    expect(titleCase('hello world')).toBe('Hello World');
    expect(titleCase('MULTIPLE words here')).toBe('Multiple Words Here');
  });

  test('handles empty strings', () => {
    expect(titleCase('')).toBe('');
  });
});

