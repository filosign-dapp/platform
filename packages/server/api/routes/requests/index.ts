import { Hono } from "hono";
import { respond } from "../../../lib/utils/respond";
import db from "../../../lib/db";
import { authSigned } from "../../middleware/auth";
import { getAddress, isAddress } from "viem";
import { enqueueJob } from "../../../lib/jobrunner/scheduler";
import { and, eq } from "drizzle-orm";

const { shareRequests, pendingJobs } = db.schema;

export default new Hono()
  .post("/", authSigned, async (ctx) => {
    const wallet = ctx.var.userWallet;

    const { recipientWallet, message, metadata } = await ctx.req.json();

    if (!recipientWallet || !isAddress(recipientWallet)) {
      return respond.err(ctx, "Invalid recipientWallet", 400);
    }

    const recipient = getAddress(recipientWallet);
    if (recipient === wallet) {
      return respond.err(ctx, "Don't ask yoursefl for permission", 400);
    }

    const newRequest = db
      .insert(shareRequests)
      .values({
        senderWallet: wallet,
        recipientWallet: recipient,
        message: message.toString().slice(0, 500),
        metadata: metadata,
      })
      .returning()
      .get();

    void enqueueJob({
      type: "NOTIFY:request:created",
      payload: {
        requestId: newRequest.id,
      },
    });

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
