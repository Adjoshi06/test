// Synthetic firm members. Emails sit on the reserved `.test` TLD and every
// name is invented — the second user exists so per-user visibility has
// something real to separate, and as the human verifier of a few values.

import type { CorpusUser } from '../types';

export const CORPUS_USERS: CorpusUser[] = [
  {
    key: 'studio-demo',
    email: 'demo@studio.test',
    displayName: 'Studio demo user',
  },
  {
    key: 'studio-lead',
    email: 'lead@studio.test',
    displayName: 'Studio lead (reviewer)',
  },
];
