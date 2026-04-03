import type { Context, ReionContext, ReionPlugin } from "reion";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";

export type BetterAuthPluginOptions = {
  /** Your Better Auth instance (created via `betterAuth({...})`). */
  auth: any;
  /** Base path to mount Better Auth handler. Default: `/api/auth`. */
  basePath?: string;
  /**
   * When true (default), attach `ctx.auth` and `ctx.authSession` helpers for non-auth routes.
   * (Requires you to augment ReionContext types in your app if you want full typing.)
   */
  attachToContext?: boolean;
};

export function createBetterAuthRouteHandler(auth: any) {
  const handler = toNodeHandler(auth);
  return async (ctx: Context) => {
    await handler(ctx.req, ctx.res.raw);
  };
}

export function BetterAuthPlugin(options: BetterAuthPluginOptions): ReionPlugin {
  return {
    name: "@reion/better-auth",
    async onRequest(ctx: ReionContext) {
      if (options.attachToContext === false) return;
      const auth = options.auth;
      ctx.auth = auth;
      ctx.authSession = () =>
        auth.api.getSession({
          headers: fromNodeHeaders(ctx.req.headers),
        });
    },
  };
}

