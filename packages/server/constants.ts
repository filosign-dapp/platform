import env from "./env";
import { keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const KB = 1024;
export const MB = 1024 * KB;

export const MAX_FILE_SIZE = 30 * MB;

export const JWTalgorithm = "HS512";
export const JWTexpiration = (7 * DAY) / 1000; // 7 days
const JWTPrivateKey = keccak256(Uint8Array.from( env.EVM_PRIVATE_KEY_SYNAPSE));
const JWTPublicKey = privateKeyToAccount(JWTPrivateKey).publicKey;
export const JWTKeypair = {private: JWTPrivateKey, public: JWTPublicKey};

export const DOMAIN = "https://filosign.xyz";
export const URI = "https://filosign.xyz";