/**
 * Typed failures of the fixture loader. The loader either seeds the corpus or
 * throws one of these — nothing is swallowed.
 */
export class FixtureSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureSeedError';
  }
}
