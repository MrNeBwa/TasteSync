import type { PlaceCategory, SearchMode } from '../shared/types/domain';

type IconProps = { size?: number };

export function MovieIcon({ size = 20 }: IconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
}

export function RestaurantIcon({ size = 20 }: IconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M11 9V3h2v6c0 2-1.5 3-3 3v9H8v-9C6 12 4.5 11 4.5 9V3h2v6c0 .7.5 1.2 1.2 1.2C8.4 10.2 9 9.7 9 9zM20 3h-1c-1.2 0-2.5 1.3-2.5 4.5 0 1.5 1 2.4 1.5 2.6v11h2V3z" /></svg>;
}

export function EntertainmentIcon({ size = 20 }: IconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" /></svg>;
}

export function SearchModeIcon({ mode, size }: { mode: SearchMode; size?: number }) {
  if (mode === 'restaurants') return <RestaurantIcon size={size} />;
  if (mode === 'entertainment') return <EntertainmentIcon size={size} />;
  return <MovieIcon size={size} />;
}

export function PlaceCategoryIcon({ category, size }: { category: PlaceCategory; size?: number }) {
  if (category === 'RESTAURANT') return <RestaurantIcon size={size} />;
  return <EntertainmentIcon size={size} />;
}