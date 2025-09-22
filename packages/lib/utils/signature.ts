import {
  parseSignature,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type Transport,
  type WalletClient,
} from "viem";
export async function signRegisterChallenge(options: {
  walletClient: WalletClient<Transport, Chain, Account>;
  challenge: string;
}) {
  const canonicalAud = "https://filosign.xyz";

  const domain = {
    name: "Filosign - Encryption Key Generation",
    version: "1",
    chainId: options.walletClient.chain.id,
  };

  const types = {
    DerivationRequest: [
      { name: "purpose", type: "string" },
      { name: "message", type: "string" },
      { name: "aud", type: "string" },
      { name: "challenge", type: "string" },
    ],
  };

  const message = {
    message: [
      "This signature will generate an encryption key for your account.",
      "The output signature will not be shared with any server, any contract or any 3rd party.",
      "Please ensure you are signing this message on a trusted domain",
      "Please Ensure your wallet is connected to the right application",
    ].join("\n"),
    purpose: "derive-encryption-key",
    aud: canonicalAud,
    challenge: options.challenge,
  };

  const flatSig = await options.walletClient.signTypedData({
    types,
    domain,
    message,
    primaryType: "DerivationRequest",
  });

  const sig = parseSignature(flatSig);

  return {
    v: sig.v,
    r: sig.r,
    s: sig.s,
    flat: flatSig,
  };
}
