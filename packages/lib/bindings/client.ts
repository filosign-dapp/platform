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
import { getContracts } from "@filosign/contracts";
import {
  deriveEncryptionMaterial,
  generateNonce,
  generateRegisterChallenge,
  generateSalts,
  regenerateEncryptionKey,
} from "filosign-crypto-utils";

type Wallet = WalletClient<Transport, Chain, Account>;

const info = `Replace with relevant shit`; // temporary, todo replace

export class FilosignClient {
  private wallet: Wallet;
  private publicClient: PublicClient;
  private contracts: ReturnType<typeof getContracts<Wallet>>;
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
  }

  async login() {}
}
