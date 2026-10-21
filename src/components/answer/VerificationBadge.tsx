// How a verification state may present itself — the spec's five-state table as
// code. Only a human-verified record may look checked (standing question 4: an
// unverified value styled as checked fails the case). The data-checked
// attribute is the testable form of that rule: true on human-verified, false
// everywhere else, never absent.

import type { Authority, VerificationState } from '@/lib/reasoner/types';

const VERIFICATION_LABEL: Record<VerificationState, string> = {
  'human-verified': 'Verified',
  interpreted: 'Read from the source — not yet checked',
  'machine-read': 'Extracted from the document',
};

export function VerificationBadge({
  verification,
  verifiedBy,
}: {
  verification: VerificationState;
  verifiedBy?: string;
}) {
  if (verification === 'human-verified') {
    return (
      <span className="badge badge-verified" data-checked="true">
        <span aria-hidden="true" className="badge-mark">
          ✓
        </span>{' '}
        Verified by {verifiedBy ?? 'a reviewer'}
      </span>
    );
  }
  return (
    <span className={`badge badge-${verification}`} data-checked="false">
      {VERIFICATION_LABEL[verification]}
    </span>
  );
}

const AUTHORITY_LABEL: Record<Authority, string> = {
  'product-doc': 'product documentation',
  code: 'code',
  project: 'project',
  correspondence: 'correspondence',
};

export function AuthorityLabel({ authority }: { authority: Authority }) {
  return <span className="authority-label">{AUTHORITY_LABEL[authority]}</span>;
}
