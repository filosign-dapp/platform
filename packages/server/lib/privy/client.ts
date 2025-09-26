import { PrivyClient } from "@privy-io/node";
import env from "../../env";

export const privy = new PrivyClient({
  appId: env.PRIVY_APP_ID,
  appSecret: env.PRIVY_APP_SECRET,
  jwtVerificationKey: env.PRIVY_JWT_VERIFICATION_KEY,
});
