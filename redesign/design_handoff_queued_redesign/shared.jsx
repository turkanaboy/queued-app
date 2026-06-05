// shared.jsx — Queued redesign — design tokens, sample data, reusable pieces.
// Everything is assigned to window at the bottom so the option scripts (separate
// babel scopes) can reference these as barewords.

/* hooks used inline via React.useState etc to avoid cross-script redeclaration */

/* ── Palette (brand: cream/brass on deep green) ───────────────────────── */
const C = {
  bgGrad:
    'radial-gradient(circle at 50% -12%, rgba(184,115,51,0.20), transparent 36%),' +
    'linear-gradient(165deg, #02110C 0%, #062318 50%, #0A3526 100%)',
  green:      '#062318',
  greenPanel: 'rgba(8,43,30,0.72)',
  greenSoft:  'rgba(5,34,24,0.66)',
  line:       'rgba(244,233,209,0.14)',
  lineStrong: 'rgba(244,233,209,0.26)',
  cream:      '#F4E9D1',
  creamText:  '#F7F1E4',
  creamDim:   'rgba(247,241,228,0.55)',
  creamFaint: 'rgba(247,241,228,0.34)',
  brass:      '#B87333',
  gold:       '#D8A84A',
  terra:      '#C96B4B',
  mint:       '#2DD48F',
  ink:        '#052016',
};

const SANS = "'Plus Jakarta Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/* ── Media types ──────────────────────────────────────────────────────── */
const MEDIA = {
  movie: { key: 'movie', label: 'Movies', singular: 'film',  cover: ['#33271a', '#1c130b'] },
  tv:    { key: 'tv',    label: 'TV',     singular: 'show',  cover: ['#2a3b2f', '#16241b'] },
  book:  { key: 'book',  label: 'Books',  singular: 'book',  cover: ['#3a2a1c', '#211610'] },
  album: { key: 'album', label: 'Albums', singular: 'album', cover: ['#3a2330', '#1e131b'] },
};
const MEDIA_ORDER = ['movie', 'tv', 'book', 'album'];

/* ── Statuses ─────────────────────────────────────────────────────────── */
const STATUS = {
  not_yet_viewed: { key: 'not_yet_viewed', label: 'New',         short: 'New',   dot: '#D8A84A' },
  queued:         { key: 'queued',         label: 'Queued',      short: 'Queued',dot: '#C99A52' },
  in_progress:    { key: 'in_progress',    label: 'In progress', short: 'Now',   dot: '#C96B4B' },
  finished:       { key: 'finished',       label: 'Finished',    short: 'Done',  dot: '#2DD48F' },
  skipped:        { key: 'skipped',        label: 'Skipped',     short: 'Skip',  dot: '#7E8C84' },
  bailed:         { key: 'bailed',         label: 'Bailed',      short: 'Bail',  dot: '#B5544A' },
};
const STATUS_ORDER = ['not_yet_viewed', 'queued', 'in_progress', 'finished', 'skipped', 'bailed'];
// statuses that read as "active backlog" vs archived
const ACTIVE_STATUSES = ['not_yet_viewed', 'queued', 'in_progress'];

const ORIGIN = {
  self:   { key: 'self',   label: 'Mine' },
  friend: { key: 'friend', label: 'Friends' },
  bot:    { key: 'bot',    label: 'Bot' },
};

/* ── Sample data (realistic mix; titles are factual references) ───────── */
const DATA = [
  // movies
  { id: 'm1', type: 'movie', title: 'Dune: Part Two',  creator: 'Denis Villeneuve', year: 2024, status: 'in_progress',    origin: { type: 'friend', name: 'Mara' } },
  { id: 'm2', type: 'movie', title: 'Past Lives',      creator: 'Celine Song',      year: 2023, status: 'queued',         origin: { type: 'self' } },
  { id: 'm3', type: 'movie', title: 'The Zone of Interest', creator: 'Jonathan Glazer', year: 2023, status: 'finished',  rating: 9, origin: { type: 'bot' } },
  { id: 'm4', type: 'movie', title: 'Anatomy of a Fall', creator: 'Justine Triet',  year: 2023, status: 'not_yet_viewed', origin: { type: 'friend', name: 'Theo' } },
  { id: 'm5', type: 'movie', title: 'Poor Things',     creator: 'Yorgos Lanthimos', year: 2023, status: 'queued',         origin: { type: 'self' } },
  { id: 'm6', type: 'movie', title: 'Aftersun',        creator: 'Charlotte Wells',  year: 2022, status: 'finished',  rating: 8, origin: { type: 'self' } },
  // tv
  { id: 't1', type: 'tv', title: 'Severance',  creator: 'Season 2',  year: 2025, status: 'in_progress',    origin: { type: 'friend', name: 'Mara' } },
  { id: 't2', type: 'tv', title: 'Shōgun',     creator: 'Limited',   year: 2024, status: 'finished', rating: 9, origin: { type: 'self' } },
  { id: 't3', type: 'tv', title: 'The Bear',   creator: 'Season 3',  year: 2024, status: 'queued',         origin: { type: 'friend', name: 'Theo' } },
  { id: 't4', type: 'tv', title: 'Ripley',     creator: 'Limited',   year: 2024, status: 'not_yet_viewed', origin: { type: 'self' } },
  { id: 't5', type: 'tv', title: 'Slow Horses',creator: 'Season 4',  year: 2024, status: 'queued',         origin: { type: 'bot' } },
  { id: 't6', type: 'tv', title: 'Fallout',    creator: 'Season 1',  year: 2024, status: 'finished', rating: 8, origin: { type: 'friend', name: 'Jules' } },
  // books
  { id: 'b1', type: 'book', title: 'Tomorrow, and Tomorrow, and Tomorrow', creator: 'Gabrielle Zevin', year: 2022, status: 'in_progress', origin: { type: 'self' } },
  { id: 'b2', type: 'book', title: 'The Bee Sting',     creator: 'Paul Murray',        year: 2023, status: 'queued',         origin: { type: 'friend', name: 'Jules' } },
  { id: 'b3', type: 'book', title: 'Trust',             creator: 'Hernan Diaz',        year: 2022, status: 'finished', rating: 8, origin: { type: 'self' } },
  { id: 'b4', type: 'book', title: 'Demon Copperhead',  creator: 'Barbara Kingsolver', year: 2022, status: 'not_yet_viewed', origin: { type: 'friend', name: 'Mara' } },
  { id: 'b5', type: 'book', title: 'James',             creator: 'Percival Everett',   year: 2024, status: 'queued',         origin: { type: 'bot' } },
  { id: 'b6', type: 'book', title: 'Babel',             creator: 'R. F. Kuang',        year: 2022, status: 'skipped',        origin: { type: 'self' } },
  // albums
  { id: 'a1', type: 'album', title: 'Brat',            creator: 'Charli XCX',     year: 2024, status: 'finished', rating: 9, origin: { type: 'self' } },
  { id: 'a2', type: 'album', title: 'Cowboy Carter',   creator: 'Beyoncé',        year: 2024, status: 'in_progress',    origin: { type: 'friend', name: 'Theo' } },
  { id: 'a3', type: 'album', title: 'Hit Me Hard and Soft', creator: 'Billie Eilish', year: 2024, status: 'finished', rating: 8, origin: { type: 'friend', name: 'Jules' } },
  { id: 'a4', type: 'album', title: 'GNX',             creator: 'Kendrick Lamar', year: 2024, status: 'not_yet_viewed', origin: { type: 'bot' } },
  { id: 'a5', type: 'album', title: 'Wall of Eyes',    creator: 'The Smile',      year: 2024, status: 'queued',         origin: { type: 'self' } },
  { id: 'a6', type: 'album', title: 'The New Sound',   creator: 'Geordie Greep',  year: 2024, status: 'queued',         origin: { type: 'self' } },
];

/* ── helpers ──────────────────────────────────────────────────────────── */
function initials(title) {
  const words = title.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
function originLabel(o) {
  if (o.type === 'self') return 'Added by you';
  if (o.type === 'bot') return 'Queued Bot';
  return o.name;
}
function computeStats(items) {
  const byStatus = {};
  STATUS_ORDER.forEach(s => { byStatus[s] = 0; });
  let ratingSum = 0, ratingN = 0;
  items.forEach(i => {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    if (i.status === 'finished' && i.rating) { ratingSum += i.rating; ratingN++; }
  });
  const active = ACTIVE_STATUSES.reduce((n, s) => n + byStatus[s], 0);
  return {
    total: items.length,
    active,
    byStatus,
    finished: byStatus.finished,
    avg: ratingN ? (ratingSum / ratingN).toFixed(1) : null,
    fromFriends: items.filter(i => i.origin.type === 'friend').length,
    fromBot: items.filter(i => i.origin.type === 'bot').length,
    mine: items.filter(i => i.origin.type === 'self').length,
  };
}

/* ── tiny geometric media glyphs (kept minimal) ───────────────────────── */
function MediaGlyph({ type, size = 13, color = C.cream }) {
  const s = { width: size, height: size, display: 'block' };
  if (type === 'movie') return (
    <svg viewBox="0 0 16 16" style={s} fill="none"><rect x="1.5" y="3" width="13" height="10" rx="1.6" stroke={color} strokeWidth="1.4"/><path d="M7 6.2l3 1.8-3 1.8z" fill={color}/></svg>
  );
  if (type === 'tv') return (
    <svg viewBox="0 0 16 16" style={s} fill="none"><rect x="1.5" y="3.5" width="13" height="8.5" rx="1.6" stroke={color} strokeWidth="1.4"/><path d="M6 13.5h4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></svg>
  );
  if (type === 'book') return (
    <svg viewBox="0 0 16 16" style={s} fill="none"><rect x="3" y="2" width="10" height="12" rx="1.2" stroke={color} strokeWidth="1.4"/><path d="M5.6 2v12" stroke={color} strokeWidth="1.3"/></svg>
  );
  return (
    <svg viewBox="0 0 16 16" style={s} fill="none"><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.4"/><circle cx="8" cy="8" r="1.5" fill={color}/></svg>
  );
}

/* ── poster placeholder (cover-art style tile) ────────────────────────── */
function Poster({ item, w = 54, h = 78, radius = 10, glyph = true }) {
  const m = MEDIA[item.type];
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, position: 'relative', overflow: 'hidden',
      background: `linear-gradient(155deg, ${m.cover[0]}, ${m.cover[1]})`,
      boxShadow: '0 4px 14px rgba(0,0,0,0.32)', flexShrink: 0,
      border: '1px solid rgba(244,233,209,0.10)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(125deg, rgba(244,233,209,0.05) 0 2px, transparent 2px 9px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontWeight: 600, color: 'rgba(244,233,209,0.82)',
        fontSize: Math.max(13, w * 0.30), letterSpacing: 1,
      }}>{initials(item.title)}</div>
      {glyph && (
        <div style={{ position: 'absolute', left: 6, bottom: 6, opacity: 0.85 }}>
          <MediaGlyph type={item.type} size={Math.max(10, w * 0.20)} color="rgba(244,233,209,0.9)" />
        </div>
      )}
    </div>
  );
}

/* ── rating chip ──────────────────────────────────────────────────────── */
function Rating({ value, mono = true }) {
  if (!value) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.gold, fontFamily: mono ? MONO : SANS, fontSize: 11, fontWeight: 600 }}>
      <span style={{ fontSize: 10 }}>★</span>{value.toFixed ? value.toFixed(1) : value}
    </span>
  );
}

/* ── status dot + label ───────────────────────────────────────────────── */
function StatusTag({ status, solid = false }) {
  const s = STATUS[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
      padding: solid ? '3px 8px' : 0,
      borderRadius: 999,
      background: solid ? 'rgba(2,17,12,0.5)' : 'transparent',
      border: solid ? `1px solid ${s.dot}55` : 'none',
      color: solid ? C.creamText : C.creamDim,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

/* ── status menu (popover to change status) ───────────────────────────── */
function StatusMenu({ value, onChange, align = 'right' }) {
  const [open, setOpen] = React.useState(false);
  const s = STATUS[value];
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        background: 'rgba(2,17,12,0.55)', border: `1px solid ${C.line}`, borderRadius: 999,
        padding: '5px 9px', color: C.creamText, fontFamily: MONO, fontSize: 10.5,
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: s.dot }} />
        {s.short}
        <svg width="8" height="6" viewBox="0 0 8 6" style={{ opacity: 0.6 }}><path d="M1 1l3 3 3-3" stroke={C.cream} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 41,
            background: 'rgba(6,30,21,0.98)', border: `1px solid ${C.lineStrong}`, borderRadius: 14,
            padding: 5, minWidth: 150, boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
          }}>
            {STATUS_ORDER.map(k => (
              <button key={k} onClick={() => { onChange(k); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', cursor: 'pointer',
                background: k === value ? 'rgba(244,233,209,0.10)' : 'transparent',
                border: 'none', borderRadius: 9, padding: '8px 10px', textAlign: 'left',
                color: C.creamText, fontFamily: SANS, fontSize: 13, fontWeight: 600,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: STATUS[k].dot }} />
                {STATUS[k].label}
                {k === value && <span style={{ marginLeft: 'auto', color: C.gold }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── bottom sheet (shared) ────────────────────────────────────────────── */
function Sheet({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(2,10,7,0.55)', backdropFilter: 'blur(2px)', animation: 'qFade .2s ease' }} />
      <div style={{
        position: 'relative', background: 'linear-gradient(180deg, #0a3526, #062318)',
        borderTop: `1px solid ${C.lineStrong}`, borderRadius: '26px 26px 0 0',
        padding: '12px 18px calc(20px + env(safe-area-inset-bottom))', boxShadow: '0 -24px 60px rgba(0,0,0,0.5)',
        animation: 'qUp .28s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 99, background: C.lineStrong, margin: '0 auto 14px' }} />
        {title && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 17, color: C.creamText }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.creamDim, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>}
        {children}
        {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ── app chrome: header + bottom nav ──────────────────────────────────── */
function AppHeader({ subtitle }) {
  return (
    <div style={{ padding: '52px 18px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 3, color: C.brass, fontWeight: 600, textTransform: 'uppercase' }}>Queued</div>
        <div style={{ fontFamily: SANS, fontSize: 25, fontWeight: 800, color: C.creamText, lineHeight: 1.1, marginTop: 2 }}>My Queue</div>
        {subtitle && <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.creamFaint, marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div style={{
        width: 42, height: 42, borderRadius: 99, padding: 2,
        background: 'linear-gradient(135deg, #F4E9D1, #D8A84A, #B87333)', flexShrink: 0,
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, hsl(160,40%,72%), #F4E9D1)', color: C.ink, fontFamily: SANS, fontWeight: 800, fontSize: 14 }}>AR</div>
      </div>
    </div>
  );
}

function BottomNav() {
  const Tab = ({ d, label, active }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: active ? 1 : 0.7 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? C.cream : 'rgba(5,32,22,0.6)',
        border: active ? 'none' : `1px solid ${C.line}`,
      }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">{d(active ? C.ink : C.cream)}</svg>
      </div>
      <span style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: active ? C.creamText : C.creamFaint }}>{label}</span>
    </div>
  );
  return (
    <div style={{ padding: '8px 16px calc(20px + env(safe-area-inset-bottom))' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(3,22,15,0.86)', backdropFilter: 'blur(20px)',
        border: `1px solid ${C.lineStrong}`, borderRadius: 26, padding: '10px 22px',
        boxShadow: '0 18px 40px rgba(0,0,0,0.34)',
      }}>
        <Tab active={false} label="Friends" d={c => <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={c} strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke={c} strokeWidth="2"/></>} />
        <Tab active={false} label="Discover" d={c => <><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2"/><polygon points="16.2,7.8 14.1,14.1 7.8,16.2 9.9,9.9" stroke={c} strokeWidth="2" strokeLinejoin="round"/></>} />
        <div style={{ width: 50, height: 50, borderRadius: 99, marginTop: -22, background: 'linear-gradient(135deg, #C96B4B, #B87333)', border: `1px solid ${C.lineStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.3)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#FFF8E8" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </div>
        <Tab active={false} label="Search" d={c => <><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="2"/><path d="M21 21l-4-4" stroke={c} strokeWidth="2" strokeLinecap="round"/></>} />
        <Tab active={true} label="Profile" d={c => <><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="2" strokeLinecap="round"/></>} />
      </div>
    </div>
  );
}

/* ── medium segmented tabs (shared base; options can restyle) ─────────── */
function MediumTabs({ value, onChange, counts, variant = 'pill' }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4, margin: '0 0 0',
      background: 'rgba(2,17,12,0.5)', border: `1px solid ${C.line}`, borderRadius: 16,
    }}>
      {MEDIA_ORDER.map(k => {
        const active = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            flex: 1, cursor: 'pointer', borderRadius: 12, padding: '8px 4px',
            background: active ? C.cream : 'transparent',
            border: active ? `1px solid ${C.gold}` : '1px solid transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            transition: 'background .15s',
          }}>
            <MediaGlyph type={k} size={15} color={active ? C.ink : C.cream} />
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: active ? C.ink : C.creamDim }}>{MEDIA[k].label}</span>
            <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 600, color: active ? 'rgba(5,32,22,0.6)' : C.creamFaint }}>{counts[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  C, SANS, MONO, MEDIA, MEDIA_ORDER, STATUS, STATUS_ORDER, ACTIVE_STATUSES, ORIGIN, DATA,
  initials, originLabel, computeStats,
  MediaGlyph, Poster, Rating, StatusTag, StatusMenu, Sheet, AppHeader, BottomNav, MediumTabs,
});
