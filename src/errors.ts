export type AuthBridgeErrorCode =
  | "unauthenticated"
  | "failed-precondition"
  | "not-found"
  | "internal";

export class AuthBridgeError extends Error {
  readonly code: AuthBridgeErrorCode;
  constructor(code: AuthBridgeErrorCode, message: string) {
    super(message);
    this.name = "AuthBridgeError";
    this.code = code;
  }
}
