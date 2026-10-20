// Correspondence — message threads with message-level locators. The Halden
// thread documents WHY the Halden flame-spread value is missing (certificate
// pending); the Terra thread restates its slip values under correspondence
// authority; the Meridian thread is private to the studio lead — the corpus's
// per-user visibility boundary made real.

import type { CorpusDocument } from '../types';

export const CORRESPONDENCE_DOCUMENTS: CorpusDocument[] = [
  {
    key: 'doc-corr-halden-fire',
    title: 'Correspondence — Halden fire certificate (synthetic fixture)',
    kind: 'correspondence',
    owner: 'studio-demo',
    passages: [
      {
        key: 'distributor',
        locator: 'msg 14 Feb 2026, author Halden distributor',
        quote:
          'Thank you for your enquiry. The fire certificate for the HAL-240 task chair is ' +
          'still with our testing laboratory; we expect issue in Q3. All other datasheets ' +
          'are current.',
      },
      {
        key: 'pm',
        locator: 'msg 02 Mar 2026, author studio PM',
        quote:
          'Noted — until the certificate lands we treat Halden flame-spread as unknown, ' +
          'not failed.',
      },
    ],
    values: [
      {
        passage: 'distributor',
        propertyId: 'fire-certificate-status',
        raw: 'certificate pending, expected Q3',
        methodId: 'stated-feature',
        authority: 'correspondence',
        verification: 'interpreted',
      },
    ],
  },
  {
    key: 'doc-corr-terra-sealing',
    title: 'Correspondence — Terra terracotta sealing (synthetic fixture)',
    kind: 'correspondence',
    owner: 'studio-demo',
    passages: [
      {
        key: 'works',
        locator: 'msg 21 Jan 2026, author Terra works',
        quote:
          'Unsealed Terra measures R9 (DIN 51130). After our impregnating sealer the ' +
          'pendulum value is PTV 36+ wet (BS 7976, 4S slider). Frost resistance is not ' +
          'warranted for outdoor use.',
      },
    ],
    values: [
      {
        passage: 'works',
        propertyId: 'slip-resistance',
        raw: 'R9 unsealed',
        methodId: 'din-51130',
        authority: 'correspondence',
        verification: 'interpreted',
      },
      {
        passage: 'works',
        propertyId: 'slip-resistance-pendulum',
        raw: 'PTV 36+ wet (sealed)',
        methodId: 'bs-7976',
        authority: 'correspondence',
        verification: 'interpreted',
      },
      // The same properties the Terra datasheet records, from a second source
      // with its own authority — the answer shows both, each under its body.
    ],
  },
  {
    key: 'doc-corr-meridian-av',
    title: 'Correspondence — Meridian AV integration [private] (synthetic fixture)',
    kind: 'correspondence',
    owner: 'studio-lead',
    passages: [
      {
        key: 'lead',
        locator: 'msg 09 Apr 2026, author studio lead',
        quote:
          'Client prefers Kestrel over Noct for the United room on budget; keep this off ' +
          'the shared brief until confirmed.',
      },
    ],
    values: [],
    // Owned by studio-lead, not studio-demo: the demo user must not see this
    // thread — the visibility boundary the library enforces at the query layer.
  },
];
