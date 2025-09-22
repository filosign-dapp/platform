import { customType, integer } from "drizzle-orm/sqlite-core";
import { isAddress, checksumAddress } from "viem";
import { jsonParse, jsonStringify } from "./utils/json";

export const timestamps = {
  createdAt: integer()
    .notNull()
    .$default(() => Date.now()),
  updatedAt: integer().$onUpdate(() => Date.now()),
  deletedAt: integer(),
};

export const evmAddressType = customType<{
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

export const JsonStringType = customType<{
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
