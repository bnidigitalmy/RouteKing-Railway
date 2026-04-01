import { Parcel } from "../types";

/**
 * Simple Nearest Neighbor Algorithm for Route Optimization
 * @param parcels List of parcels to optimize
 * @param startPoint Starting coordinates (e.g., current location)
 * @returns Optimized list of parcels
 */
export function optimizeRoute(parcels: Parcel[], startPoint: { lat: number; lng: number }): Parcel[] {
  if (parcels.length <= 1) return parcels;

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

  // Assign new sequence numbers based on optimized order
  return optimized.map((p, index) => ({
    ...p,
    sequenceNumber: index + 1
  }));
}
