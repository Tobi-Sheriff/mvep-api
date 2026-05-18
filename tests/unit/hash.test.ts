import { hashPassword, comparePassword } from '../../src/lib/hash';

describe('hashPassword', () => {
  it('returns a string different from the input', async () => {
    const hash = await hashPassword('mypassword');
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('mypassword');
  });

  it('produces a different hash each call (salt is random)', async () => {
    const h1 = await hashPassword('mypassword');
    const h2 = await hashPassword('mypassword');
    expect(h1).not.toBe(h2);
  });
});

describe('comparePassword', () => {
  it('returns true for the correct plaintext', async () => {
    const hash = await hashPassword('mypassword');
    expect(await comparePassword('mypassword', hash)).toBe(true);
  });

  it('returns false for the wrong plaintext', async () => {
    const hash = await hashPassword('mypassword');
    expect(await comparePassword('wrongpassword', hash)).toBe(false);
  });

  it('returns false for an empty string', async () => {
    const hash = await hashPassword('mypassword');
    expect(await comparePassword('', hash)).toBe(false);
  });
});
