import { TOKENS, CONTRACT_ADDRESSES } from "@filoz/synapse-sdk";
import { ethers } from "ethers";
import { synapse } from "./lib/synapse";

const amount = ethers.parseUnits("5", 18); // USDFC
await synapse.payments.deposit(amount);

const warmStorageAddress = synapse.getWarmStorageAddress();
await synapse.payments.approveService(
  warmStorageAddress,
  /*rate allowance*/ ethers.parseUnits("10", 18),
  /*lockup allowance*/ ethers.parseUnits("1000", 18),
  /*max lockup preiod*/ 86_400n /* 30 days (in epochs) */
);
