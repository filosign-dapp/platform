import jwt from "jsonwebtoken";
import { z } from "zod";
import { JWTalgorithm, JWTexpiration, JWTKeypair } from "../../constants";
import { isAddress, type Address } from "viem";

const zEvmAddress = z
  .string()
  .refine((value) => isAddress(value), {
    message: "Invalid EVM address format",
  })
  .transform((value) => value as Address);

export const zJwtPayload = () =>
  z.object({
    iss: z.string(), // issuer
    sub: zEvmAddress, // subject (wallet address)
    iat: z.number(), // issued at
    exp: z.number(), // expires at
    nbf: z.number(), // not before
  });

export type JwtPayload = z.infer<ReturnType<typeof zJwtPayload>>;

export function createJwtPayload(walletAddress: Address): JwtPayload {
  const now = Math.floor(Date.now() / 1000);

  return {
    iss: JWTKeypair.public,
    sub: walletAddress,
    iat: now - 2,
    exp: now + JWTexpiration,
    nbf: now - 1,
  };
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWTKeypair.private, {
    algorithm: JWTalgorithm,
  });
}

export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWTKeypair.private, {
    algorithms: [JWTalgorithm],
  });

  return zJwtPayload().parse(decoded);
}

export function issueJwtToken(walletAddress: Address): string {
  const payload = createJwtPayload(walletAddress);
  return signJwt(payload);
}
