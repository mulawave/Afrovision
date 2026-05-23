import { getHomeCommunityPoolApi } from "@/lib/api";

const HOME_STATS_TTL_MS = 5 * 60_000;

export interface CommunityPoolStats {
  total_vpt: number;
  total_ngn: number;
  vpt_rate: number;
  naira_equivalent: number;
  total_distributed_vpt: number;
  total_distributed_ngn: number;
  total_beneficiaries: number;
}

let communityPoolCache: CommunityPoolStats | null = null;
let communityPoolCacheUpdatedAt = 0;
let communityPoolRequestInFlight: Promise<CommunityPoolStats | null> | null = null;

export function getCachedCommunityPoolStats() {
  return communityPoolCache;
}

export async function getCommunityPoolStats(forceRefresh = false): Promise<CommunityPoolStats | null> {
  const now = Date.now();
  if (!forceRefresh && communityPoolCache && now - communityPoolCacheUpdatedAt < HOME_STATS_TTL_MS) {
    return communityPoolCache;
  }

  if (!communityPoolRequestInFlight) {
    communityPoolRequestInFlight = (async () => {
      try {
        const res = await getHomeCommunityPoolApi();
        if (res.ok && "community_pool" in res.data) {
          communityPoolCache = res.data.community_pool;
          communityPoolCacheUpdatedAt = Date.now();
        }

        return communityPoolCache;
      } catch {
        return communityPoolCache;
      } finally {
        communityPoolRequestInFlight = null;
      }
    })();
  }

  return communityPoolRequestInFlight;
}