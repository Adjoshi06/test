import { describe, expect, it } from 'vitest';
import type { IdentityProvider, ProviderUser, SignInInput } from './provider';

/**
 * The provider contract: anything implementing IdentityProvider can resolve
 * sign-in input to an existing firm user — the seam Google OAuth will join.
 * These tests pin the contract with a stub, not a database.
 */

class StubProvider implements IdentityProvider {
  constructor(
    private readonly users: readonly ProviderUser[],
    private readonly acceptedKind: SignInInput['kind']
  ) {}

  async authenticate(input: SignInInput): Promise<ProviderUser | null> {
    if (input.kind !== this.acceptedKind) {
      return null;
    }
    return this.users[0] ?? null;
  }
}

const ROSTER: readonly ProviderUser[] = [
  { userId: 'u-1', email: 'ada@firm.test', displayName: 'Ada' },
];

describe('IdentityProvider contract', () => {
  it('resolves matching credentials to a firm user', async () => {
    const provider = new StubProvider(ROSTER, 'email');
    const resolved = await provider.authenticate({ kind: 'email', email: 'ada@firm.test' });
    expect(resolved).toEqual(ROSTER[0]);
  });

  it('refuses a kind it does not accept with the same null as unknown credentials', async () => {
    const provider = new StubProvider(ROSTER, 'email');
    const refused = await provider.authenticate({ kind: 'google', subject: 'sub-1' });
    expect(refused).toBeNull();
  });

  it('returns the same null shape when the roster is empty', async () => {
    const provider = new StubProvider([], 'email');
    const resolved = await provider.authenticate({ kind: 'email', email: 'ada@firm.test' });
    expect(resolved).toBeNull();
  });
});
