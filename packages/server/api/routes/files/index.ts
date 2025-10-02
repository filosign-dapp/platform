import { Hono } from "hono";
import { respond } from "../../../lib/utils/respond";
import db from "../../../lib/db";
import { authSigned } from "../../middleware/auth";
import { bucket } from "../../../lib/s3/client";
import { getOrCreateUserDataset } from "../../../lib/synapse";

const { files } = db.schema;
const MAX_FILE_SIZE = 30 * 1024 * 1024;

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
    if (!pieceCid || typeof pieceCid !== "string") {
      return respond.err(ctx, "Invalid pieceCid", 400);
    }

    const fileExists = bucket.exists(`uploads/${pieceCid}`);
    if (!fileExists) {
      return respond.err(ctx, "File not found on storage", 400);
    }

    const file = bucket.file(`uploads/${pieceCid}`);
    if (file.size > MAX_FILE_SIZE) {
      file.delete();
      return respond.err(ctx, "File exceeds maximum allowed size", 413);
    }

    const bytes = await file.arrayBuffer();

    if (bytes.byteLength === 0) {
      file.delete();
      return respond.err(ctx, "Uploaded file is empty", 400);
    }

    const ds = await getOrCreateUserDataset(ctx.var.userWallet);

    const preflight = await ds.preflightUpload(file.size);

    if (!preflight.allowanceCheck.sufficient) {
      return respond.err(
        ctx,
        "Insufficient storage allowance, complan to the devs",
        402
      );
    }

    const uploadResult = await ds.upload(bytes);

    file.delete();

    if (!uploadResult.pieceCid.equals(pieceCid)) {
      return respond.err(ctx, "Invalid pieceCid claimed", 403);
    }

    const inserResult = db
      .insert(files)
      .values({
        pieceCid: pieceCid,
        ownerWallet: ctx.var.userWallet,
        // recipientWallet: null,
      })
      .returning()
      .get();

    return respond.ok(
      ctx,
      inserResult,
      "File uploaded to filecoin warmstorage",
      201
    );
  });
