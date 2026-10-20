/**
 * Typed failures of the library service. Every path either returns what it
 * promised or throws one of these — nothing is swallowed, and constraint
 * violations carry their cause.
 */

/** A write was attempted without an authenticated caller. */
export class LibraryAccessError extends Error {
  constructor(message = 'Unauthenticated callers cannot write to the library.') {
    super(message);
    this.name = 'LibraryAccessError';
  }
}

/**
 * The requested record does not exist — or exists but belongs to another
 * owner. The two are deliberately indistinguishable: invisibility must not
 * leak existence.
 */
export class LibraryNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found in the library.`);
    this.name = 'LibraryNotFoundError';
  }
}

/** An integrity invariant was violated at the engine or the service layer. */
export class LibraryIntegrityError extends Error {
  constructor(message: string, options?: { constraint?: string; cause?: unknown }) {
    super(options?.constraint ? `${message} (constraint: ${options.constraint})` : message, {
      cause: options?.cause,
    });
    this.name = 'LibraryIntegrityError';
  }
}
