import { useMutation, useQuery } from "@tanstack/react-query";
import { useFilosignContext } from "./FilosignProvider";
import { useMemo } from "react";
import type { FilosignClient } from "..";

export type Path<T> = T extends object
  ? {
      [K in keyof T]-?: T[K] extends (...args: any[]) => any
        ? [K]
        : T[K] extends object
        ? [K, ...Path<T[K]>]
        : never;
    }[keyof T]
  : never;

export type PathValue<T, P extends readonly any[]> = P extends [
  infer K,
  ...infer Rest
]
  ? K extends keyof T
    ? Rest extends []
      ? T[K]
      : PathValue<T[K], Rest>
    : never
  : never;

export type MethodFromPath<T, P extends readonly any[]> = PathValue<
  T,
  P
> extends (...args: infer A) => infer R
  ? (...args: A) => R
  : never;

export function resolvePath<T, P extends readonly (keyof any)[]>(
  root: T,
  path: readonly [...P]
): { parent: any; key: string | number | symbol; value: any } | undefined {
  if (!root) return undefined;
  let parent: any = root as any;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i] as any;
    if (parent == null) return undefined;
    parent = parent[k];
  }
  const lastKey = path[path.length - 1] as any;
  if (parent == null) return undefined;
  const value = parent[lastKey];
  return { parent, key: lastKey, value };
}

export function useFilosignQuery<
  T extends FilosignClient,
  P extends Path<T> & readonly any[]
>(...path: P) {
  const { client } = useFilosignContext();

  const method = useMemo(() => {
    const info = resolvePath(client, path);
    if (!info) return undefined;
    const { parent, value } = info;
    if (typeof value === "function") {
      return (value as Function).bind(parent) as MethodFromPath<T, P>;
    }
    return undefined;
  }, [client, ...(path as any)]) as MethodFromPath<T, P> | undefined;

  return useQuery({
    queryKey: ["filosign", ...path],
    queryFn: async () => {
      if (!method) {
        throw new Error("Method not found");
      }
      return method();
    },
    enabled: !!method,
  });
}

export function useFilosignMutation<
  T extends FilosignClient,
  P extends Path<T> & readonly any[]
>(...path: P) {
  const { client } = useFilosignContext();

  const method = useMemo(() => {
    const info = resolvePath(client, path);
    if (!info) return undefined;
    const { parent, value } = info;
    if (typeof value === "function") {
      return (value as Function).bind(parent) as MethodFromPath<T, P>;
    }
    return undefined;
  }, [client, ...(path as any)]) as MethodFromPath<T, P> | undefined;

  return useMutation({
    mutationKey: ["filosign", ...path],
    mutationFn: async () => {
      if (!method) {
        throw new Error("Method not found");
      }
      return method();
    },
  });
}
