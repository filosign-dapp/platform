import {
  createPublicClient,
  encodePacked,
  keccak256,
  toHex,
  type Account,
  type Chain,
  type Hash,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { filecoinCalibration } from "viem/chains";
import { getContracts } from "@filosign/contracts";
import {
  deriveEncryptionMaterial,
  generateNonce,
  generateRegisterChallenge,
  generateSalts,
  regenerateEncryptionKey,
  toB64,
} from "filosign-crypto-utils";

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
    const signature = await this.wallet.signMessage({
      message: challenge,
    });

    const { encSeed } = deriveEncryptionMaterial(
      signature,
      pin,
      salts.pinSalt,
      salts.authSalt,
      salts.wrapperSalt,
      info
    );

    const pinCommitment = keccak256(
      encodePacked(["string", "string"], [salts.pinSalt, pin])
    );

    await this.tx(
      this.contracts.FSKeyRegistry.write.registerKeygenData([
        {
          nonce: `0x${toHex(nonce)}`,
          salt_pin: `0x${toHex(salts.pinSalt)}`,
          salt_auth: `0x${toHex(salts.authSalt)}`,
          salt_wrap: `0x${toHex(salts.wrapperSalt)}`,
          seed: `0x${toHex(encSeed)}`,
          commitment_pin: pinCommitment,
        },
      ])
    );

    const { encryptionKey } = regenerateEncryptionKey(
      signature,
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
      stored_seed,
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
      seed: toB64(stored_seed),
    };

    const { challenge } = generateRegisterChallenge(
      this.address,
      this.version.toString(),
      stored.nonce
    );

    const regenerated_signature = await this.wallet.signMessage({
      message: challenge,
    });

    const { encryptionKey } = regenerateEncryptionKey(
      regenerated_signature,
      pin,
      stored.salt_pin,
      stored.salt_auth,
      stored.salt_wrap,
      stored.seed,
      "test"
    );

    this.encryptionKey = Uint8Array.from(encryptionKey);
  }
}
