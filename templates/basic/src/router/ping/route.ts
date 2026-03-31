import type { Context } from "reion";

export async function GET(ctx: Context) {
  ctx.res.status(200);
  return { message: "pong" };
}
