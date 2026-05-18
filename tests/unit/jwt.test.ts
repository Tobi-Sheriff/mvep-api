import jwt from 'jsonwebtoken';
import { signToken, verifyToken, JwtPayload } from '../../src/lib/jwt';
import { config } from '../../src/config';

const payload: JwtPayload = { sub: 'user-123', role: 'customer' };

describe('signToken', () => {
  it('returns a non-empty string', () => {
    const token = signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('produces a token with three JWT segments', () => {
    const token = signToken(payload);
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyToken', () => {
  it('decodes the original payload', () => {
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe(payload.role);
  });

  it('throws on a malformed token', () => {
    expect(() => verifyToken('garbage.token.here')).toThrow();
  });

  it('throws on a token signed with a different secret', () => {
    const foreign = jwt.sign(payload, 'wrong-secret');
    expect(() => verifyToken(foreign)).toThrow();
  });

  it('throws on an expired token', () => {
    const expired = jwt.sign(payload, config.JWT_SECRET, { expiresIn: -1 });
    expect(() => verifyToken(expired)).toThrow();
  });
});
