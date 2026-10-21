/**
 * Typed failures of the methods registry. Mirrors the library's error
 * discipline: every path returns what it promised or throws one of these —
 * nothing is swallowed, and engine violations carry their cause.
 */

/**
 * The registry is the account of which methods exist. Comparing against an
 * unregistered id is a data-integrity gap to surface loudly — never a
 * comparison outcome, and never silently coerced to not-comparable.
 */
export class RegistryNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found in the methods registry.`);
    this.name = 'RegistryNotFoundError';
  }
}

/** An integrity invariant was violated at the engine or the service layer. */
export class RegistryIntegrityError extends Error {
  constructor(message: string, options?: { constraint?: string; cause?: unknown }) {
    super(options?.constraint ? `${message} (constraint: ${options.constraint})` : message, {
      cause: options?.cause,
    });
    this.name = 'RegistryIntegrityError';
  }
}
