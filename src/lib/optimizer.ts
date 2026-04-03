import { Parcel } from "../types";
import { withRetry } from "./utils";

/**
 * Fallback: Simple Nearest Neighbor Algorithm (Straight-line distance)
 */
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

  return optimized.map((p, index) => ({
    ...p,
    sequenceNumber: index + 1
  }));
}

/**
 * Advanced Route Optimization using OSRM (Open Source Routing Machine)
 * This calculates routes based on actual road networks, preventing zig-zags.
 * @param parcels List of parcels to optimize
 * @param startPoint Starting coordinates (e.g., current location)
 * @returns Optimized list of parcels
 */
export async function optimizeRoute(parcels: Parcel[], startPoint: { lat: number; lng: number }): Promise<Parcel[]> {
  if (parcels.length <= 1) return parcels;

  try {
    // OSRM expects coordinates in longitude,latitude format
    // We limit to ~100 coordinates to avoid URL length limits on public OSRM API
    if (parcels.length > 100) {
      console.warn("Too many parcels for OSRM, falling back to straight-line");
      return fallbackOptimizeRoute(parcels, startPoint);
    }

    const coords = [
      `${startPoint.lng},${startPoint.lat}`,
      ...parcels.map(p => `${p.lng},${p.lat}`)
    ].join(';');

    // Call OSRM Trip API with retry
    const data = await withRetry(async () => {
      const response = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false`);
      
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

    // Create an array to hold the sorted parcels
    const optimized: Parcel[] = new Array(parcels.length);
    
    // waypoints[0] is the startPoint.
    // waypoints[1...n] are the parcels.
    for (let i = 1; i < data.waypoints.length; i++) {
      const wp = data.waypoints[i];
      // wp.waypoint_index is the position in the optimized route (0-based, where 0 is startPoint)
      const optimizedIndex = wp.waypoint_index - 1; 
      optimized[optimizedIndex] = parcels[i - 1];
    }

    // Filter out any undefined (just in case) and reassign sequence numbers
    return optimized.filter(Boolean).map((p, index) => ({
      ...p,
      sequenceNumber: index + 1
    }));

  } catch (error) {
    console.warn("OSRM routing failed, falling back to straight-line distance", error);
    return fallbackOptimizeRoute(parcels, startPoint);
  }
}
