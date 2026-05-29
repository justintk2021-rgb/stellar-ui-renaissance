/** Google Fonts CSS URLs keyed by notebook font id — loaded on demand */
export const FONT_GOOGLE_URLS: Record<string, string> = {
  inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  roboto: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'open-sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap',
  lato: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  montserrat: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
  poppins: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  raleway: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap',
  nunito: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap',
  ubuntu: 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap',
  rubik: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap',
  oswald: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap',
  'dm-sans': 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
  'space-grotesk': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
  outfit: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
  'work-sans': 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap',
  'plus-jakarta': 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  manrope: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap',
  sora: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap',
  lexend: 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap',
  urbanist: 'https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap',
  figtree: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap',
  archivo: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap',
  barlow: 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap',
  karla: 'https://fonts.googleapis.com/css2?family=Karla:wght@400;500;600;700&display=swap',
  quicksand: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap',
  comfortaa: 'https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;500;600;700&display=swap',
  'varela-round': 'https://fonts.googleapis.com/css2?family=Varela+Round&display=swap',
  merriweather: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
  playfair: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
  'libre-baskerville': 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap',
  crimson: 'https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&display=swap',
  'source-serif': 'https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&display=swap',
  cormorant: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap',
  'eb-garamond': 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap',
  spectral: 'https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&display=swap',
  bitter: 'https://fonts.googleapis.com/css2?family=Bitter:wght@400;500;600;700&display=swap',
  lora: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
  'source-code': 'https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600;700&display=swap',
  'fira-code': 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap',
  jetbrains: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'ibm-plex': 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap',
  'space-mono': 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
  'roboto-mono': 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap',
  cousine: 'https://fonts.googleapis.com/css2?family=Cousine:wght@400;700&display=swap',
  anonymous: 'https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&display=swap',
  'overpass-mono': 'https://fonts.googleapis.com/css2?family=Overpass+Mono:wght@400;500;600;700&display=swap',
  inconsolata: 'https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;500;600;700&display=swap',
};

const loadedFonts = new Set<string>(['inter', 'jetbrains']);

export function loadGoogleFont(fontId: string) {
  if (loadedFonts.has(fontId)) return;
  const url = FONT_GOOGLE_URLS[fontId];
  if (!url) return;
  loadedFonts.add(fontId);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}
