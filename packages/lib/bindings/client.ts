import {
  createPublicClient,
  encodePacked,
  keccak256,
  sliceHex,
  toHex,
  concatHex,
  type Account,
  type Address,
  type Chain,
  type Hash,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { filecoinCalibration } from "viem/chains";
import { getContracts } from "@filosign/contracts";
import {
  createSharedKey,
  deriveEncryptionMaterial,
  generateNonce,
  generateRegisterChallenge,
  generateSalts,
  getPublicKeyFromRegenerated,
  regenerateEncryptionKey,
  toB64,
} from "filosign-crypto-utils";
import { signRegisterChallenge } from "../utils/signature";

type Wallet = WalletClient<Transport, Chain, Account>;

const info = `Replace with relevant shit`; // temporary, todo replace
const primaryChain = filecoinCalibration;

export class FilosignClient {
  private wallet: Wallet;
  private publicClient: PublicClient;
  private contracts: ReturnType<typeof getContracts<Wallet>>;
  private encryptionKey: Uint8Array | null = null;
  version = 1;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
    this.contracts = getContracts(wallet);

    this.publicClient = createPublicClient({
      transport: wallet.transport as unknown as Transport,
      chain: wallet.chain,
    });
  }

  async initialize() {
    this.version = await this.contracts.FSManager.read.version();

    if (primaryChain.id !== this.wallet.chain.id) {
      await this.wallet.switchChain({ id: primaryChain.id });
    }
  }

  get address() {
    return this.wallet.account.address;
  }

  private async tx(txnPromise: Promise<Hash>) {
    const hash = await txnPromise;
    return await this.publicClient.waitForTransactionReceipt({ hash });
  }

  private async deriveRawAesKey(raw: Uint8Array) {
    if (!(raw instanceof Uint8Array) || raw.length !== 32) {
      throw new Error("raw must be Uint8Array(32)");
    }
    return crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM", length: 256 },
      false, // non-extractable means cant export raw bytes
      ["encrypt", "decrypt"]
    );
  }

  async isRegistered() {
    return await this.contracts.FSKeyRegistry.read.isRegistered([this.address]);
  }

  async register(pin: string) {
    if (await this.isRegistered()) {
      throw new Error("Address is already registered");
    }

    const salts = generateSalts();
    const nonce = generateNonce();
    const { challenge } = generateRegisterChallenge(
      this.address,
      this.version.toString(),
      nonce
    );
    const signature = await signRegisterChallenge({
      walletClient: this.wallet,
      challenge,
    });

    const { encSeed } = deriveEncryptionMaterial(
      signature.flat,
      pin,
      salts.pinSalt,
      salts.authSalt,
      salts.wrapperSalt,
      info
    );

    const pinCommitment = keccak256(
      encodePacked(["string", "string"], [salts.pinSalt, pin])
    );

    const { publicKey } = getPublicKeyFromRegenerated(
      signature.flat,
      pin,
      salts.pinSalt,
      salts.authSalt,
      salts.wrapperSalt,
      encSeed,
      info
    );

    const encSeedHex = `0x${toHex(encSeed)}` as const;

    await this.tx(
      this.contracts.FSKeyRegistry.write.registerKeygenData([
        {
          nonce: `0x${toHex(nonce)}`,
          salt_pin: `0x${toHex(salts.pinSalt)}`,
          salt_auth: `0x${toHex(salts.authSalt)}`,
          salt_wrap: `0x${toHex(salts.wrapperSalt)}`,
          seed_head: sliceHex(encSeedHex, 0, 20),
          seed_word: sliceHex(encSeedHex, 20, 52),
          seed_tail: sliceHex(encSeedHex, 52, 72),
          commitment_pin: pinCommitment,
        },
        `0x${toHex(publicKey)}`,
      ])
    );

    const { encryptionKey } = regenerateEncryptionKey(
      signature.flat,
      pin,
      salts.pinSalt,
      salts.authSalt,
      salts.wrapperSalt,
      encSeed,
      info
    );
    this.encryptionKey = Uint8Array.from(encryptionKey);
  }

  async login(pin: string) {
    if (!(await this.isRegistered())) {
      throw new Error("Address is not registered");
    }

    const pinCommitment = keccak256(
      encodePacked(["string", "string"], [toB64(pin), pin])
    );

    const [
      stored_salt_auth,
      stored_salt_wrap,
      stored_salt_pin,
      stored_nonce,
      stored_seed_head,
      stored_seed_word,
      stored_seed_tail,
      stored_commitment_pin,
    ] = await this.contracts.FSKeyRegistry.read.keygenData([this.address]);

    if (stored_commitment_pin !== pinCommitment) {
      throw new Error("Invalid PIN");
    }

    const stored = {
      salt_auth: toB64(stored_salt_auth),
      salt_wrap: toB64(stored_salt_wrap),
      salt_pin: toB64(stored_salt_pin),
      nonce: toB64(stored_nonce),
      seed: toB64(
        concatHex([stored_seed_head, stored_seed_word, stored_seed_tail])
      ),
    };

    const { challenge } = generateRegisterChallenge(
      this.address,
      this.version.toString(),
      stored.nonce
    );

    const regenerated_signature = await signRegisterChallenge({
      walletClient: this.wallet,
      challenge,
    });

    const { encryptionKey } = regenerateEncryptionKey(
      regenerated_signature.flat,
      pin,
      stored.salt_pin,
      stored.salt_auth,
      stored.salt_wrap,
      stored.seed,
      info
    );

    this.encryptionKey = Uint8Array.from(encryptionKey);
  }

  async encrypt(data: Uint8Array, recipient: Address) {
    if (!this.encryptionKey) {
      throw new Error("Client is not logged in - encryption key is missing");
    }

    const recipientPubKey = await this.contracts.FSKeyRegistry.read.publicKeys([
      recipient,
    ]);

    const { sharedKey } = createSharedKey(
      this.encryptionKey.toString(),
      recipientPubKey
    );
    const cryptoKey = await this.deriveRawAesKey(Uint8Array.from(sharedKey));

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      cryptoKey,
      data
    );

    return { encrypted, iv };
  }

  async decrypt(encrypted: ArrayBuffer, iv: Uint8Array, sender: Address) {
    if (!this.encryptionKey) {
      throw new Error("Client is not logged in - encryption key is missing");
    }

    const senderPubKey = await this.contracts.FSKeyRegistry.read.publicKeys([
      sender,
    ]);

    const { sharedKey } = createSharedKey(
      this.encryptionKey.toString(),
      senderPubKey
    );
    const cryptoKey = await this.deriveRawAesKey(Uint8Array.from(sharedKey));

    return await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      cryptoKey,
      encrypted
    );
  }
}
