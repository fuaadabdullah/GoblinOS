// Temporary module shims to unblock TypeScript build while proper types are added.
// These are short-term; replace with `@types/*` or proper typings for production.
declare module "pg";
declare module "nats";
declare module "redis";

// If specific types are needed later, create concrete declarations here.
