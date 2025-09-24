import * as sys from "./sys";
import * as shareCapability from "./shareCapability";
import * as user from "./user";
import * as file from "./file";

// Combine all schema parts
const schema = {
  ...sys,
  ...shareCapability,
  ...user,
  ...file,
};

export default schema;

type DBSchema = typeof schema;
// export type DB = {
//   [K in keyof DBSchema as K extends `${infer Base}s` // Tables typically end with 's'
//     ? Base // Standard table name (convert 'users' to 'user', etc.)
//     : K extends UtilityFunctions // Exclude utility functions
//     ? never
//     : K]: K extends keyof DBSchema
//     ? DBSchema[K] extends { $inferSelect: any }
//       ? DBSchema[K]["$inferSelect"]
//       : never
//     : never;
// };
