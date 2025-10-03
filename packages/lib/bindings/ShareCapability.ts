import type { Address } from "viem";
import type { Defaults } from "../types/client";
import type Logger from "./Logger";
import z from "zod";

export default class ShareCapability {
  private defaults: Defaults;
  private logger: Logger;

  constructor(defaults: Defaults) {
    this.defaults = defaults;
    this.logger = defaults.logger;

    this.logger.info("Posts interface instantiated");
  }

  async sendShareRequest(options: {
    recipientWallet: Address;
    message: string;
    metadata?: Record<string, any>;
  }) {
    const { apiClient } = this.defaults;
    apiClient.ensureJwt();
    const response = await apiClient.rpc.postSafe(
      { id: z.string() },
      "/requests",
      {
        recipientWallet: options.recipientWallet,
        message: options.message,
        metadata: options.metadata,
      }
    );
    return response;
  }

  async getPendingShareRequests() {
    const { apiClient } = this.defaults;
    apiClient.ensureJwt();
    const response = await apiClient.rpc.getSafe(
      {
        requests: z.array(
          z.object({
            id: z.string(),
            senderWallet: z.string(),
            message: z.string().nullable(),
            metadata: z.record(z.string(), z.any()).nullable(),
            status: z.literal("PENDING"),
            createdAt: z.string(),
          })
        ),
      },
      "/requests/pending"
    );
    return response;
  }

  async cancelShareRequest(options: { requestId: string }) {
    const { apiClient } = this.defaults;
    apiClient.ensureJwt();
    const response = await apiClient.rpc.postSafe(
      { canceled: z.string() },
      `/requests/${options.requestId}/cancel`
    );
    return response;
  }

  async allowSharing(options: { senderWallet: Address }) {
    const { contracts, tx } = this.defaults;

    const receipt = await tx(
      contracts.FSManager.write.approveSender([options.senderWallet])
    );
    return receipt;
  }
}
