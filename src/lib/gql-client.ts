export type GqlVars = Record<string, unknown>;

export async function gql<T = unknown>(
  query: string,
  variables?: GqlVars,
  opts?: { signal?: AbortSignal }
): Promise<T> {
  const isServer = typeof window === "undefined";
  const base = isServer
    ? process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3000"
    : "";
  const res = await fetch(`${base}/api/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: opts?.signal,
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }
  return json.data as T;
}
