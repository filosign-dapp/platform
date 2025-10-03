import { Hono } from "hono";
import { isAddress, type Address } from "viem";
import { respond } from "../../../lib/utils/respond";
import {
  createSiweMessage,
  generateSiweNonce,
  verifySiweMessage,
} from "viem/siwe";
import { primaryChain } from "../../../config";
import { DOMAIN, URI } from "../../../constants";
import { provider } from "../../../lib/indexer/provider";
import { issueJwtToken } from "../../../lib/utils/jwt";
import { authenticated } from "../../middleware/auth";
import db from "../../../lib/db";
import { eq } from "drizzle-orm";

const messages: Record<Address, { message: string; validTill: number }> = {};
const { users, profiles } = db.schema;

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

  .get("/profile", authenticated, async (ctx) => {
    const wallet = ctx.var.userWallet;

    const userData = db
      .select({
        walletAddress: users.walletAddress,
        email: users.email,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        bio: profiles.bio,
        metadataJson: profiles.metadataJson,
      })
      .from(users)
      .leftJoin(profiles, eq(users.walletAddress, profiles.walletAddress))
      .where(eq(users.walletAddress, wallet))
      .get();

    if (!userData) {
      return respond.err(ctx, "User not found", 404);
    }

    return respond.ok(ctx, userData, "User data retrieved", 200);
  })

  .get("/profile/:username", authenticated, async (ctx) => {

    const { username } = ctx.req.param();

    const usernameAvailable = db.select().from(profiles).where(eq(profiles.username, username)).get();
    if (usernameAvailable) {
      return respond.ok(ctx, { available: false }, "Username unavailable", 200);
    }
    return respond.ok(ctx, { available: true }, "Username available", 200);
  })

  .post("/profile", authenticated, async (ctx) => {
    const wallet = ctx.var.userWallet;
    const { username, displayName } = await ctx.req.json();

    const existingUsername = db.select().from(profiles).where(eq(profiles.username, username)).get();
    if (existingUsername) {
      return respond.err(ctx, "Username already exists", 400);
    }

    const newProfile = db.insert(profiles).values({
      walletAddress: wallet,
      username,
      displayName
    }).returning().get();

    return respond.ok(ctx, newProfile, "Profile created successfully", 201);
  })

  .put("/profile", authenticated, async (ctx) => {
    const wallet = ctx.var.userWallet;
    const { username, displayName, avatarUrl, bio, metadataJson } = await ctx.req.json();

    const existingProfile = db
      .select()
      .from(profiles)
      .where(eq(profiles.walletAddress, wallet))
      .get();

    if (!existingProfile) {
      return respond.err(ctx, "Profile not found", 404);
    }

    const updatedProfile = db.update(profiles)
      .set({
        username,
        displayName,
        avatarUrl,
        bio,
        metadataJson,
      })
      .where(eq(profiles.walletAddress, wallet)).returning()
      .get();

    return respond.ok(ctx, updatedProfile, "Profile updated successfully", 200);
  });