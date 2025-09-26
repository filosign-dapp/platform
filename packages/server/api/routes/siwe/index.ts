import { zValidator } from "@hono/zod-validator";
import db from "../../../lib/db";
import { Hono } from "hono";
import { respond } from "../../../lib/utils/respond";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { isAddress, isHash, type Address } from "viem";
import { primaryChain } from "../../../config";

const {} = db.schema;

const EIP4361Registry: Record<Address, string> = {};

export default new Hono()
  .get("/:address", async (ctx) => {
    const { address } = ctx.req.param();

    if (!address || !isAddress(address)) {
      return respond.err(ctx, "Address not found", 404);
    }

    const message = createSiweMessage({
      address: address,
      chainId: primaryChain.id,
      domain: "filosign.xyz",
      nonce: generateSiweNonce(),
      uri: "https://filosign.xyz/",
      version: "1",
    });

    EIP4361Registry[address] = message;

    return respond.ok(ctx, { message }, "Nonce here", 200);
  })
  .post("/:address", async (ctx) => {
    const { address } = ctx.req.param();

    if (!address || !isAddress(address)) {
      return respond.err(ctx, "Address not found", 404);
    }
    if (!EIP4361Registry[address]) {
      return respond.err(ctx, "please request a message first", 400);
    }

    const { signature } = await ctx.req.json();
    if (!signature || !isHash(signature)) {
      return respond.err(ctx, "Invalid signature", 400);
    }

    const siweMessage = EIP4361Registry[address];

    const valid = await publicClient.verifySiweMessage({
      message,
      signature,
    });
  });
