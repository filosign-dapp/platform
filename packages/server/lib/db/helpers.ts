import { customType, integer } from "drizzle-orm/sqlite-core";
import { isAddress, checksumAddress, isHash } from "viem";
import { jsonParse, jsonStringify } from "./utils/json";

export const timestamps = {
  createdAt: integer()
    .notNull()
    .$default(() => Date.now()),
  updatedAt: integer().$onUpdate(() => Date.now()),
  deletedAt: integer(),
};

export const tEvmAddress = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    if (!isAddress(value)) {
      throw new Error(`Invalid EVM address: ${value}`);
    }
    return checksumAddress(value);
  },
  fromDriver(value) {
    return value;
  },
});

export const tJsonString = customType<{
  data: Record<string, any>;
  driverData: string;
}>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    return jsonStringify(value);
  },
  fromDriver(value) {
    return jsonParse(value);
  },
});

export const tHash = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    if (!isHash(value)) {
      throw new Error(`Invalid hash: ${value}`);
    }
    return value;
  },
  fromDriver(value) {
    return value;
  },
});

export const tBoolean = customType<{
  data: boolean;
  driverData: number;
}>({
  dataType() {
    return "integer";
  },
  toDriver(value) {
    return value ? 1 : 0;
  },
  fromDriver(value) {
    return value === 1;
  },
});

export const tBigInt = customType<{
  data: bigint;
  driverData: string;
}>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    return value.toString();
  },
  fromDriver(value) {
    return BigInt(value);
  },
});
