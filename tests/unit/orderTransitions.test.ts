import { isValidTransition } from '../../src/modules/orders/orders.service';

describe('isValidTransition', () => {
  it('pending → processing is valid', () => {
    expect(isValidTransition('pending', 'processing')).toBe(true);
  });

  it('pending → cancelled is valid', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true);
  });

  it('processing → shipped is valid', () => {
    expect(isValidTransition('processing', 'shipped')).toBe(true);
  });

  it('processing → cancelled is valid', () => {
    expect(isValidTransition('processing', 'cancelled')).toBe(true);
  });

  it('shipped → delivered is valid', () => {
    expect(isValidTransition('shipped', 'delivered')).toBe(true);
  });

  it('shipped → pending is invalid (backward)', () => {
    expect(isValidTransition('shipped', 'pending')).toBe(false);
  });

  it('pending → shipped is invalid (skip step)', () => {
    expect(isValidTransition('pending', 'shipped')).toBe(false);
  });

  it('delivered → cancelled is invalid (terminal)', () => {
    expect(isValidTransition('delivered', 'cancelled')).toBe(false);
  });

  it('delivered → processing is invalid (terminal)', () => {
    expect(isValidTransition('delivered', 'processing')).toBe(false);
  });

  it('cancelled → processing is invalid (terminal)', () => {
    expect(isValidTransition('cancelled', 'processing')).toBe(false);
  });

  it('cancelled → pending is invalid (terminal)', () => {
    expect(isValidTransition('cancelled', 'pending')).toBe(false);
  });
});
