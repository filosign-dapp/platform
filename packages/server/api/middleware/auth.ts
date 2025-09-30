import { createMiddleware } from "hono/factory";
import { respond } from "../../lib/utils/respond";
import {
  isAddress,
  isHash,
  verifyMessage,
  type Address,
  type Hash,
} from "viem";

const consumedSignatures: Record<Hash, boolean> = {};

export const authSigned = createMiddleware<{
  Variables: {
    userWallet: Address;
  };
}>(async (ctx, next) => {
  const sig = ctx.req.header("x-auth-signature");
  const claimedAddr = ctx.req.header("x-auth-address");
  const tsHeader = ctx.req.header("x-auth-timestamp");

  if (!sig || !claimedAddr || !tsHeader) {
    return respond.err(ctx, "Headers not found", 401);
  }
  if (!isHash(sig) || !isAddress(claimedAddr)) {
    return respond.err(ctx, "Invalid signature or address", 401);
  }
  if (consumedSignatures[sig]) {
    return respond.err(ctx, "Signature already used", 401);
  }

  const timestamp = Number(tsHeader);
  if (isNaN(timestamp) || timestamp <= 0) {
    return respond.err(ctx, "Invalid timestamp", 401);
  }

  const now = Date.now();
  const TTL_MS = 6 * 1000;
  if (timestamp + TTL_MS < now) {
    return respond.err(ctx, "Reuest too old", 408);
  }

  const message = `Filosign\n${claimedAddr}\n${timestamp}`;
  consumedSignatures[sig] = true;

  const valid = verifyMessage({
    message: message,
    signature: sig,
    address: claimedAddr,
  });

  if (!valid) {
    return respond.err(ctx, "Invalid signature", 401);
  }

  ctx.set("userWallet", claimedAddr);

  await next();
});
