import type { betterAuth } from "better-auth";

export type BetterAuthInstance = ReturnType<typeof betterAuth>;
type GetSessionReturn = Awaited<ReturnType<BetterAuthInstance["api"]["getSession"]>>;

declare module "reion" {
  interface ReionContext {
    /** The Better Auth instance passed to `BetterAuthPlugin({ auth })`. */
    auth: BetterAuthInstance;
    /** Convenience helper: `auth.api.getSession({ headers: ... })`. */
    authSession: () => Promise<GetSessionReturn>;
  }
}

export {};

