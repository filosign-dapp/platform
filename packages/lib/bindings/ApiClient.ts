import { hc } from "hono/client";
import Logger from "./Logger";
import axios, { type AxiosInstance } from "axios";

export default class ApiClient {
  private _client: AxiosInstance;
  private _authHeader: { Authorization: `Bearer ${string}` };
  private _baseUrl: string;

  constructor(baseUrl: string) {
    this._client = this.createClient();
    this._baseUrl = baseUrl;
    this._authHeader = { Authorization: "Bearer null" };
  }

  private createClient() {
    return axios.create({
      baseURL: this._baseUrl,
      timeout: 10_000,
      headers: {
        Authorization: this._authHeader.Authorization,
      },
    });
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
