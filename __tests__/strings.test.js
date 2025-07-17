const { titleCase } = require('../utils/strings');

describe('titleCase', () => {
  test('converts words to title case', () => {
    expect(titleCase('hello world')).toBe('Hello World');
    expect(titleCase('MULTIPLE words here')).toBe('Multiple Words Here');
    expect(titleCase('  many   spaces  ')).toBe('Many Spaces');
    expect(titleCase('line\nbreaks')).toBe('Line Breaks');
  });

  test('handles empty strings', () => {
    expect(titleCase('')).toBe('');
  });
});

