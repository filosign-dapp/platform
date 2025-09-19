export type AtLeast<T> = T & Record<string, unknown>;

export const noop: () => void = () => {};
