import { createMiddleware } from "hono/factory";
import { type Address, isAddress } from "viem";
import { privy } from "../../lib/privy/client";
import db from "../../lib/db";
import {ethereum} from "viem"
import { eq } from "drizzle-orm";

const ensureUser = createMiddleware<{
  Variables: {
    user: { address: Address };
  };
}>(async (ctx, next) => {
  const idToken = ctx.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!idToken) return ctx.text("Unauthorized", 401);

  const privyUser = await privy.users().get({ id_token: idToken });

  let { 0: user } = await db
    .select()
    .from(db.schema.users)
    .where(eq(db.schema.users., privyUser.linked_accounts[0].))
    .limit(1);

  if (!user) {
    const address = privyUser.wallet?.address;

    if (!address) return ctx.text("Missing embedded wallet", 401);
    if (!isAddress(address)) {
      return ctx.text("Invalid EVM wallet retrieved from Privy", 401);
    }

    const { 0: newUser } = await db
      .insert(users)
      .values({
        address,
        privyId,
      })
      .returning();

    user = newUser;
  }

  ctx.set("user", user as DB["user"] & { address: Address });
  await next();
});

export default ensureUser;
