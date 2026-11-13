describe('settings schema', () => {
  it('declares extractToNamedFolder as a boolean, default true, and no other key', () => {
    const schema = jest.requireActual('../../schema/plugin.json');
    expect(Object.keys(schema.properties)).toEqual(['extractToNamedFolder']);
    expect(schema.properties.extractToNamedFolder.type).toBe('boolean');
    expect(schema.properties.extractToNamedFolder.default).toBe(true);
    expect(schema.additionalProperties).toBe(false);
  });
});
