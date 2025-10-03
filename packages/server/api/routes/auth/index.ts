import { Hono } from "hono";
import {
  isAddress,
  type Address,
} from "viem";
import { respond } from "../../../lib/utils/respond";
import {
  createSiweMessage,
  generateSiweNonce,
  verifySiweMessage,
} from "viem/siwe";
import { primaryChain } from "../../../config";
import { DOMAIN, URI } from "../../../constants";
import { provider } from "../../../lib/indexer/provider";
import { issueJwtToken } from "../../../../lib/utils/jwt";

const messages: Record<Address, { message: string; validTill: number }> = {};

export default new Hono()

  .get("/message", async (ctx) => {
    const wallet = ctx.req.query("wallet_address");
    if (!wallet || !isAddress(wallet)) {
      return respond.err(ctx, "Missing wallet address", 400);
    }

    const nonce = generateSiweNonce();

    const message = createSiweMessage({
      address: wallet,
      chainId: primaryChain.id,
      domain: DOMAIN,
      nonce: nonce,
      uri: URI,
      version: "1",
    });

    const validTill = Date.now() + 5 * 60 * 1000;
    messages[wallet] = { message, validTill };

    return respond.ok(ctx, { message, nonce }, "SIWE message generated", 200);
  })

  .get("/verify", async (ctx) => {
    const { signature, wallet } = await ctx.req.json();

    if (!signature) {
      return respond.err(ctx, "Missing signature", 400);
    }

    if (!wallet || !isAddress(wallet)) {
      return respond.err(ctx, "Missing or invalid wallet address", 400);
    }

    const msgData = messages[wallet];
    delete messages[wallet];

    if (!msgData || msgData.validTill < Date.now()) {
      return respond.err(ctx, "Message expired or not found", 400);
    }

    const { message } = msgData;

    // todo move public client
    const valid = await verifySiweMessage(provider, {
      message,
      signature,
      address: wallet,
    });

    if (!valid) {
      return respond.err(ctx, "Invalid signature", 400);
    }

    const token = issueJwtToken(wallet);
    return respond.ok(ctx, { valid, token }, "Signature verified", 200);
  })

//   .get("/claim/nonce", async (ctx) => {
//     const wallet = ctx.req.query("wallet_address");
//     if (!wallet || !isAddress(wallet)) {
//       return respond.err(ctx, "Missing wallet address", 400);
//     }
//     const nonce = toHex(Uint8Array.from(Bun.randomUUIDv7()).slice(0, 20));
//     const validTill = Date.now() + 30 * 1000; // 30 seconds
//     nonces[wallet] = { nonce, validTill };
//     return respond.ok(ctx, { nonce, validTill }, "Nonce generated", 200);
//   })

//   .post("/claim/verify", async (ctx) => {
//     const { authSignature, walletSignature, walletAddress, authAddress } =
//       await ctx.req.json();

//     const nonceData = nonces[walletAddress];
//     delete nonces[walletAddress];

//     if (!nonceData || nonceData.validTill < Date.now()) {
//       return respond.err(ctx, "Nonce expired or not found", 400);
//     }
//     if (!authSignature || !walletSignature) {
//       return respond.err(ctx, "Missing signatures", 400);
//     }

//     const hashWithAuthAddress = keccak256(
//       encodePacked(["bytes20", "address"], [nonceData.nonce, authAddress])
//     );
//     const hashWithWalletAddress = keccak256(
//       encodePacked(["bytes20", "address"], [nonceData.nonce, walletAddress])
//     );

//     const validAuthSignature = await verifyMessage({
//       address: authAddress,
//       message: hashWithWalletAddress,
//       signature: authSignature,
//     });
//     const validWalletSignature = await verifyMessage({
//       address: walletAddress,
//       message: hashWithAuthAddress,
//       signature: walletSignature,
//     });

//     const valid = validAuthSignature && validWalletSignature;

//     if (!valid) {
//       return respond.err(ctx, "Invalid signatures", 400);
//     }

//     db.update(users)
//       .set({ authAddress })
//       .where(eq(users.walletAddress, walletAddress))
//       .run();

//     return respond.ok(ctx, { valid }, "Signatures verified", 200);
//   });
