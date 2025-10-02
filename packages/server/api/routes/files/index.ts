import { Hono } from "hono";
import { respond } from "../../../lib/utils/respond";
import db from "../../../lib/db";
import { authSigned } from "../../middleware/auth";
import { getAddress, isAddress } from "viem";
import { enqueueJob } from "../../../lib/jobrunner/scheduler";
import { and, eq } from "drizzle-orm";
import { bucket } from "../../../lib/s3/client";

const { shareRequests } = db.schema;

export default new Hono()
  .post("/upload/start", authSigned, async (ctx) => {
    const { pieceCid } = await ctx.req.json();

    const userWallet = ctx.var.userWallet;
    const key = `uploads/${pieceCid}`;

    const presignedUrl = bucket.presign(key, {
      method: "PUT",
      expiresIn: 60,
      type: "application/octet-stream",
      acl: "public-read",
    });

    return ctx.json({ uploadUrl: presignedUrl, key });
  })
  .post("/", authSigned, async (ctx) => {
    const { pieceCid } = await ctx.req.json();

    const fileExists = bucket.exists(`uploads/${pieceCid}`);
    if (!fileExists) {
      return respond.err(ctx, "File not found on storage", 400);
    }

    const file = await bucket.file(`uploads/${pieceCid}`).arrayBuffer();

    return respond.ok(ctx, newRequest, "Share request created", 201);
  })
  .get("/pending", authSigned, async (ctx) => {
    const rows = db
      .select()
      .from(shareRequests)
      .where(
        and(
          eq(shareRequests.recipientWallet, ctx.var.userWallet),
          eq(shareRequests.status, "PENDING")
        )
      )
      .orderBy(shareRequests.createdAt)
      .all();

    return respond.ok(ctx, { requests: rows }, "Pending requests fetched", 200);
  })
  .delete("/:id/cancel", authSigned, async (ctx) => {
    const { id } = ctx.req.param();
    if (!id) return respond.err(ctx, "Missing id parameter", 400);

    const row = db
      .select()
      .from(shareRequests)
      .where(eq(shareRequests.id, id))
      .get();
    if (!row) return respond.err(ctx, "Request not found", 404);

    const sender = getAddress(row.senderWallet);
    if (sender !== ctx.var.userWallet) {
      return respond.err(ctx, "Only the sender may cancel this request", 403);
    }

    if (row.status !== "PENDING") {
      return respond.err(ctx, "Only pending requests can be cancelled", 409);
    }

    db.update(shareRequests)
      .set({
        status: "CANCELLED",
      })
      .where(eq(shareRequests.id, id))
      .run();

    void enqueueJob({
      type: "request:cancelled",
      payload: JSON.stringify({
        requestId: id,
      }),
    });

    return respond.ok(ctx, { canceled: id }, `Request ${id} canceled`, 200);
  });
