import { Parcel } from "../types";
import { withRetry } from "./utils";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  result: Parcel[];
  expiresAt: number;
}

const routeCache = new Map<string, CacheEntry>();

function getRouteKey(parcels: Parcel[], startPoint: { lat: number; lng: number }): string {
  // Coarse grid for start point so small movements still hit cache
  const coarseLat = Math.round(startPoint.lat * 1000) / 1000;
  const coarseLng = Math.round(startPoint.lng * 1000) / 1000;
  const ids = parcels.map(p => p.id).sort().join(',');
  return `${coarseLat},${coarseLng}|${ids}`;
}

function fallbackOptimizeRoute(parcels: Parcel[], startPoint: { lat: number; lng: number }): Parcel[] {
  const unvisited = [...parcels];
  const optimized: Parcel[] = [];
  let currentPos = startPoint;

  while (unvisited.length > 0) {
    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const parcel = unvisited[i];
      if (!parcel.lat || !parcel.lng) continue;

      const dist = Math.sqrt(
        Math.pow(parcel.lat - currentPos.lat, 2) +
        Math.pow(parcel.lng - currentPos.lng, 2)
      );

      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    const nextParcel = unvisited.splice(closestIndex, 1)[0];
    optimized.push(nextParcel);
    currentPos = { lat: nextParcel.lat!, lng: nextParcel.lng! };
  }

  return optimized.map((p, index) => ({ ...p, sequenceNumber: index + 1 }));
}

/**
 * Optimizes delivery route using OSRM (road network) with a nearest-neighbour
 * fallback. Results are cached for 5 minutes to avoid redundant API calls.
 */
export async function optimizeRoute(
  parcels: Parcel[],
  startPoint: { lat: number; lng: number }
): Promise<Parcel[]> {
  if (parcels.length <= 1) return parcels;

  const cacheKey = getRouteKey(parcels, startPoint);
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  const setCache = (result: Parcel[]) => {
    routeCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  };

  try {
    if (parcels.length > 100) {
      return setCache(fallbackOptimizeRoute(parcels, startPoint));
    }

    const coords = [
      `${startPoint.lng},${startPoint.lat}`,
      ...parcels.map(p => `${p.lng},${p.lat}`),
    ].join(';');

    const data = await withRetry(async () => {
      const response = await fetch(
        `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OSRM API failed (${response.status}): ${errorText}`);
      }

      const json = await response.json();
      if (json.code !== 'Ok' || !json.waypoints) {
        throw new Error(`Invalid OSRM response: ${json.code}`);
      }
      return json;
    }, { maxRetries: 2, initialDelay: 2000 });

    const optimized: Parcel[] = new Array(parcels.length);
    for (let i = 1; i < data.waypoints.length; i++) {
      const wp = data.waypoints[i];
      const optimizedIndex = wp.waypoint_index - 1;
      optimized[optimizedIndex] = parcels[i - 1];
    }

    const result = optimized.filter(Boolean).map((p, index) => ({
      ...p,
      sequenceNumber: index + 1,
    }));

    return setCache(result);
  } catch (error) {
    const fallback = fallbackOptimizeRoute(parcels, startPoint);
    return setCache(fallback);
  }
}
