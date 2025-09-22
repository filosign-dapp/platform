import fjsStringify from "fast-json-stable-stringify";

export const jsonStringify = fjsStringify;

export const jsonParse = JSON.parse;

export const jsonClone = <T>(obj: T): T => {
  return jsonParse(jsonStringify(obj));
};
