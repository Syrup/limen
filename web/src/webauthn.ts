/**
 * The login and register pages import this at runtime, so the passkey library
 * ships from our origin instead of a CDN.
 */
export { startAuthentication, startRegistration } from "@simplewebauthn/browser";
