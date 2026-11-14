/** Domain errors carry a stable code so actions can return them to the UI without leaking internals. */
export type DomainErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid"
  | "conflict"
  | "insufficient_hours"
  | "rate_limited"
  | "bad_signature"
  | "policy";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const fail = (code: DomainErrorCode, message: string): never => {
  throw new DomainError(code, message);
};
