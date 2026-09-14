export function getYouTubeEmbedUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    let id = '';

    if (parsed.hostname.includes('youtu.be')) {
      id = parsed.pathname.slice(1);
    } else if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        id = parsed.searchParams.get('v') ?? '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        id = parsed.pathname.split('/')[2] ?? '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        id = parsed.pathname.split('/')[2] ?? '';
      }
    }

    if (!id) return null;

    const query = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      playsinline: '1',
      controls: '1',
      rel: '0',
      modestbranding: '1',
    });

    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${query.toString()}`;
  } catch {
    return null;
  }
}
