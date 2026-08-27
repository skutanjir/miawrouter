import { NextResponse } from "next/server";
import { FILTERS, FILTER_URLS, findProviderFetcher, extractModels } from "./filters.js";
import { getProviderConnections } from "@/models";

export const dynamic = "force-dynamic";

// Some registries point at endpoints that require the account's own key. When an
// unauthenticated probe comes back 401/403, retry once with the active stored
// connection's credentials (apiKey preferred, then accessToken).
async function fetchModelsPayload(url, providerId) {
  const attempt = (token) =>
    fetch(url, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await attempt();
  if ((res.status === 401 || res.status === 403) && providerId) {
    try {
      const connections = await getProviderConnections({ provider: providerId });
      const active = connections.find((c) => c.isActive !== false);
      const token = active?.apiKey || active?.accessToken;
      if (token) res = await attempt(token);
    } catch {
      // credential lookup is best-effort — keep the original response
    }
  }
  return res;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("provider");
  const type = searchParams.get("type");

  // Resolve the fetcher either by registry provider id (preferred) or by legacy
  // filter-type key. Only fixed URLs registered server-side are ever fetched —
  // client-supplied URLs are ignored (authenticated SSRF guard).
  let url;
  let filter;
  if (providerId) {
    const fetcher = findProviderFetcher(providerId);
    if (!fetcher) {
      return NextResponse.json({ data: [], status: "empty" });
    }
    url = fetcher.url;
    filter = FILTERS[fetcher.type];
  } else if (type) {
    filter = FILTERS[type];
    url = FILTER_URLS[type];
    if (!filter || !url) {
      return NextResponse.json({ data: [], status: "empty" });
    }
  } else {
    return NextResponse.json({ data: [], status: "empty" });
  }

  try {
    const res = await fetchModelsPayload(url, providerId);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ data: [], authRequired: true });
      }
      return NextResponse.json({ data: [] });
    }
    const json = await res.json();
    const data = filter(extractModels(json));
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
