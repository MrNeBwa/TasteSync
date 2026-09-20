import type { Coords } from '../types/domain';

type GeoPosition = {
  coords: { latitude: number; longitude: number; accuracy?: number };
};

const LOCATION_TIMEOUT_MS = 10_000;

function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Геолокация не поддерживается браузером'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: LOCATION_TIMEOUT_MS,
      maximumAge: 300_000,
    });
  });
}

export function isGeoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export async function getCurrentCoords(): Promise<Coords> {
  const position = await getCurrentPosition();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

export async function reverseGeocode(coords: Coords): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(coords.latitude));
    url.searchParams.set('lon', String(coords.longitude));
    url.searchParams.set('zoom', '10');
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { address?: Record<string, string> };
    if (!data.address) return null;
    return (
      data.address.city ??
      data.address.town ??
      data.address.village ??
      data.address.suburb ??
      data.address.county ??
      null
    );
  } catch {
    return null;
  }
}

export async function getCurrentCity(): Promise<{ coords: Coords; city: string | null }> {
  const coords = await getCurrentCoords();
  const city = await reverseGeocode(coords);
  return { coords, city };
}

type GeocodeHit = { coords: Coords; city: string | null };

export async function geocodeCity(query: string): Promise<GeocodeHit | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('addressdetails', '1');
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Array<{
      lat: string;
      lon: string;
      address?: Record<string, string>;
      display_name?: string;
    }>;
    const hit = data[0];
    if (!hit) return null;
    const address = hit.address ?? {};
    const city =
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.county ??
      (hit.display_name ? hit.display_name.split(',')[0].trim() : null) ??
      null;
    return {
      coords: { latitude: Number(hit.lat), longitude: Number(hit.lon) },
      city,
    };
  } catch {
    return null;
  }
}