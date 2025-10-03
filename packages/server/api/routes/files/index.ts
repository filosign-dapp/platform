import { Hono } from "hono";
import { respond } from "../../../lib/utils/respond";
import db from "../../../lib/db";
import { authenticated } from "../../middleware/auth";
import { bucket } from "../../../lib/s3/client";
import { getOrCreateUserDataset } from "../../../lib/synapse";
import { and, desc, eq, isNotNull } from "drizzle-orm";

const { files, fileSignatures, profiles } = db.schema;
const MAX_FILE_SIZE = 30 * 1024 * 1024;

export default new Hono()
  .post("/upload/start", authenticated, async (ctx) => {
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

  .post("/", authenticated, async (ctx) => {
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
  })

  .get("/sent", authenticated, async (ctx) => {
    const wallet = ctx.get("userWallet");
    const page = parseInt(ctx.req.query("page") || "1");
    const limit = Math.min(parseInt(ctx.req.query("limit") || "20"), 100);
    const offset = (page - 1) * limit;

    const sentFiles = db
      .select({
        pieceCid: files.pieceCid,
        recipientWallet: files.recipientWallet,
        metadata: files.metadata,
        acknowledged: files.acknowledged,
        onchainTxHash: files.onchainTxHash,
        acknowledgedTxHash: files.acknowledgedTxHash,
        createdAt: files.createdAt,
        updatedAt: files.updatedAt,
        recipientProfile: {
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(files)
      .leftJoin(profiles, eq(files.recipientWallet, profiles.walletAddress))
      .where(
        and(
          eq(files.ownerWallet, wallet),
          isNotNull(files.recipientWallet),
          isNotNull(files.onchainTxHash)
        )
      )
      .orderBy(desc(files.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const filesWithSignatures = await Promise.all(
      sentFiles.map(async (file) => {
        const signatures = db
          .select({
            id: fileSignatures.id,
            signerWallet: fileSignatures.signerWallet,
            signatureVisualHash: fileSignatures.signatureVisualHash,
            timestamp: fileSignatures.timestamp,
            compactSignature: fileSignatures.compactSignature,
            onchainTxHash: fileSignatures.onchainTxHash,
            createdAt: fileSignatures.createdAt,
            signerProfile: {
              username: profiles.username,
              displayName: profiles.displayName,
              avatarUrl: profiles.avatarUrl,
            },
          })
          .from(fileSignatures)
          .leftJoin(
            profiles,
            eq(fileSignatures.signerWallet, profiles.walletAddress)
          )
          .where(eq(fileSignatures.filePieceCid, file.pieceCid))
          .orderBy(desc(fileSignatures.timestamp))
          .all();

        return {
          ...file,
          signatures,
        };
      })
    );

    return respond.ok(
      ctx,
      {
        files: filesWithSignatures,
        pagination: {
          page,
          limit,
          hasMore: sentFiles.length === limit,
        },
      },
      "Sent files retrieved successfully",
      200
    );
  })

  .get("/received", authenticated, async (ctx) => {
    const wallet = ctx.get("userWallet");
    const page = parseInt(ctx.req.query("page") || "1");
    const limit = Math.min(parseInt(ctx.req.query("limit") || "20"), 100);
    const offset = (page - 1) * limit;

    const receivedFiles = db
      .select({
        pieceCid: files.pieceCid,
        ownerWallet: files.ownerWallet,
        metadata: files.metadata,
        acknowledged: files.acknowledged,
        onchainTxHash: files.onchainTxHash,
        acknowledgedTxHash: files.acknowledgedTxHash,
        createdAt: files.createdAt,
        updatedAt: files.updatedAt,
        senderProfile: {
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        },
      })
      .from(files)
      .leftJoin(profiles, eq(files.ownerWallet, profiles.walletAddress))
      .where(eq(files.recipientWallet, wallet))
      .orderBy(desc(files.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const filesWithSignatures = await Promise.all(
      receivedFiles.map(async (file) => {
        const signatures = db
          .select({
            id: fileSignatures.id,
            signerWallet: fileSignatures.signerWallet,
            signatureVisualHash: fileSignatures.signatureVisualHash,
            timestamp: fileSignatures.timestamp,
            compactSignature: fileSignatures.compactSignature,
            onchainTxHash: fileSignatures.onchainTxHash,
            createdAt: fileSignatures.createdAt,
            signerProfile: {
              username: profiles.username,
              displayName: profiles.displayName,
              avatarUrl: profiles.avatarUrl,
            },
          })
          .from(fileSignatures)
          .leftJoin(
            profiles,
            eq(fileSignatures.signerWallet, profiles.walletAddress)
          )
          .where(eq(fileSignatures.filePieceCid, file.pieceCid))
          .orderBy(desc(fileSignatures.timestamp))
          .all();

        return {
          ...file,
          signatures,
        };
      })
    );

    return respond.ok(
      ctx,
      {
        files: filesWithSignatures,
        pagination: {
          page,
          limit,
          hasMore: receivedFiles.length === limit,
        },
      },
      "Received files retrieved successfully",
      200
    );
  });
