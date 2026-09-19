import { PlaceCategoryIcon } from './icons';
import type { Place, VoteValue } from '../shared/types/domain';

const ACCENTS: Record<string, React.CSSProperties> = {
  RESTAURANT: { '--place-accent': '#efbd42', '--place-accent2': '#f06aa7' } as React.CSSProperties,
  ENTERTAINMENT: { '--place-accent': '#f06aa7', '--place-accent2': '#efbd42' } as React.CSSProperties,
};

function mapUrl(place: Place): string {
  const query = encodeURIComponent(`${place.latitude},${place.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function PlaceCard({ place, busy, onVote }: { place: Place; busy: boolean; onVote: (value: VoteValue) => void }) {
  const accent = ACCENTS[place.category] ?? ACCENTS.RESTAURANT;
  const kind = place.category === 'RESTAURANT' ? 'RESTAURANT' : 'ENTERTAINMENT';
  const meta = [place.rating ? `★ ${place.rating.toFixed(1)}` : null, place.price_level, place.city].filter(Boolean).join(' · ');
  const tags = place.tags.length > 0 ? place.tags : (place.cuisine ?? '').split(';').map(s => s.trim()).filter(Boolean).slice(0, 4);

  return <div className="movie-stage-enhanced place-stage" style={accent}>
    <section className="place-visual-card">
      <div className="place-visual-stage">
        {place.image_url ? <div className="place-photo" style={{ backgroundImage: `url(${place.image_url})` }} /> : <div className="place-standin"><div className="icon-scaffold"><PlaceCategoryIcon category={place.category} size={60} /></div><span className="place-standin-label">{kind}</span></div>}
        <div className="place-caption"><span className="eyebrow">{kind} · {place.city ?? 'рядом с вами'}</span><h3>{place.name}</h3>{tags.length > 0 && <div className="place-subtags">{tags.slice(0, 4).map(tag => <span className="tag-dark" key={tag}>{tag}</span>)}</div>}</div>
      </div>
      <div className="movie-votes"><button className="vote no" disabled={busy} onClick={() => onVote('DISLIKE')} aria-label="Не нравится">✕</button><button className="vote skip" disabled={busy} onClick={() => onVote('SKIP')} aria-label="Пропустить">↗</button><button className="vote yes" disabled={busy} onClick={() => onVote('LIKE')} aria-label="Нравится">♥</button></div>
    </section>
    <aside className="movie-info-enhanced">
      <div className="info-title-block">
        <span className="info-label">NOW LOOKING</span>
        <h2>{place.name}</h2>
        {tags.length > 0 && <div className="tag-row">{tags.slice(0, 4).map(tag => <span className="tag dark" key={tag}>{tag}</span>)}</div>}
        <span className="info-meta">{meta || 'Данные открытых карт'}</span>
      </div>
      <div className="info-label">ADDRESS</div>
      <p>{place.address || 'Адрес пока недоступен.'}</p>
      {(place.opening_hours || place.phone) && <div className="place-info-row">
        {place.opening_hours && <span className="place-info-chip"><b>ЧАСЫ</b> {place.opening_hours}</span>}
        {place.phone && <a className="place-info-chip" href={`tel:${place.phone}`}><b>ТЕЛ</b> {place.phone}</a>}
      </div>}
      <div className="place-actions">
        {(place.website || place.phone) && <a className="btn btn-dark" href={place.website ?? `tel:${place.phone}`} target={place.website ? '_blank' : undefined} rel="noreferrer">Сайт ↗</a>}
        <a className="btn btn-primary" href={mapUrl(place)} target="_blank" rel="noreferrer">На карте →</a>
      </div>
      <div className="explore-note"><span>WHY THIS PLACE</span><strong>Заведения из открытых карт OpenStreetMap рядом с вашим текущим местоположением.</strong></div>
    </aside>
  </div>;
}