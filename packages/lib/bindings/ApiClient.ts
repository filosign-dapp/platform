import { hc } from "hono/client";
import Logger from "./Logger";
import axios, { Axios, type AxiosInstance } from "axios";
import { z, type ZodRawShape, type ZodType } from "zod";

export default class ApiClient {
  private _client: ExtendedAxios;
  private _authHeader: { Authorization: `Bearer ${string}` };
  private _baseUrl: string;

  constructor(baseUrl: string) {
    this._baseUrl = baseUrl;
    this._authHeader = { Authorization: "Bearer null" };
    this._client = this.createClient();
  }

  private createClient() {
    const instance = axios.create({
      baseURL: this._baseUrl,
      timeout: 10_000,
      headers: {
        Authorization: this._authHeader.Authorization,
      },
    });
    return new ExtendedAxios(instance);
  }

  public ensureJwt() {
    if (!this.jwtExists) {
      throw new Error("JWT token is missing - user is not logged in");
    }
  }

  get jwtExists() {
    return this._authHeader.Authorization !== "Bearer null";
  }

  get rpc() {
    return this._client;
  }

  setJwt(authToken: string | null) {
    this._authHeader = { Authorization: `Bearer ${authToken}` };
    this._client = this.createClient();
  }
}

class ExtendedAxios {
  private axios: AxiosInstance;

  constructor(baseAxios: AxiosInstance) {
    this.axios = baseAxios;
  }

  get base() {
    return this.axios;
  }

  private getApiResponseZodType<T>(zodType: ZodType<T>) {
    return z
      .object({
        success: z.literal(true),
        data: zodType,
        message: z.string().optional(),
      })
      .or(
        z.object({
          success: z.literal(false),
          error: z.string().optional(),
        })
      );
  }

  async getSafe<T extends ZodRawShape>(
    zResponseShape: T,
    ...args: Parameters<AxiosInstance["get"]>
  ) {
    const resp = await this.axios.get(...args);
    const parsed = this.getApiResponseZodType(z.object(zResponseShape)).parse(
      resp.data
    );
    if (!parsed.success) {
      throw new Error(parsed.error || "API returned an error");
    }
    return parsed;
  }

  async postSafe<T extends ZodRawShape>(
    zResponseShape: T,
    ...args: Parameters<AxiosInstance["post"]>
  ) {
    const resp = await this.axios.post(...args);
    const parsed = this.getApiResponseZodType(z.object(zResponseShape)).parse(
      resp.data
    );
    if (!parsed.success) {
      throw new Error(parsed.error || "API returned an error");
    }
    return parsed;
  }

  async putSafe<T extends ZodRawShape>(
    zResponseShape: T,
    ...args: Parameters<AxiosInstance["put"]>
  ) {
    const resp = await this.axios.put(...args);
    const parsed = this.getApiResponseZodType(z.object(zResponseShape)).parse(
      resp.data
    );
    if (!parsed.success) {
      throw new Error(parsed.error || "API returned an error");
    }
    return parsed;
  }

  async deleteSafe<T extends ZodRawShape>(
    zResponseShape: T,
    ...args: Parameters<AxiosInstance["delete"]>
  ) {
    const resp = await this.axios.delete(...args);
    const parsed = this.getApiResponseZodType(z.object(zResponseShape)).parse(
      resp.data
    );
    if (!parsed.success) {
      throw new Error(parsed.error || "API returned an error");
    }
    return parsed;
  }
}
