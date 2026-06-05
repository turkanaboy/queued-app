// app-data.jsx — green language (G), app data (friends, discover, bot, shared
// lists) and shared app chrome (Avatar, AppBottomNav, SearchField, SectionTitle,
// EmptyState). Builds on shared.jsx (C, MEDIA, STATUS, DATA, Poster, …).

/* ── green-forward language (shared across every screen) ──────────────── */
const G = {
  bg:
    'radial-gradient(circle at 50% -10%, rgba(184,115,51,0.16), transparent 34%),' +
    'radial-gradient(120% 70% at 50% 118%, rgba(45,212,143,0.12), transparent 60%),' +
    'linear-gradient(166deg, #03150E 0%, #0A3A28 56%, #0F4E37 100%)',
  hero:
    'radial-gradient(120% 130% at 0% 0%, rgba(45,212,143,0.16), transparent 46%),' +
    'linear-gradient(158deg, #11543C 0%, #0C3F2C 58%, #082A1D 100%)',
  heroBorder: 'rgba(216,168,74,0.36)',
  panel: 'rgba(12,62,44,0.55)',
  panelSolid: 'rgba(9,48,33,0.92)',
  panelLine: 'rgba(150,214,180,0.16)',
  rowLine: 'rgba(150,214,180,0.12)',
  track: 'rgba(190,236,210,0.13)',
  spine: 'rgba(184,115,51,0.62)',
  tabBar: 'rgba(8,46,32,0.72)',
  ctrlBg: 'rgba(10,52,36,0.7)',
  chipBg: 'rgba(9,46,32,0.66)',
  textDim: 'rgba(214,240,224,0.7)',
  textFaint: 'rgba(214,240,224,0.5)',
};

const BOT_ID = 'bot';

/* ── people ───────────────────────────────────────────────────────────── */
const FRIENDS = [
  { id: 'mara',  name: 'Mara Lin',    username: 'maralin',   hue: 330, queue: 14, fromYou: 6, fromThem: 9 },
  { id: 'theo',  name: 'Theo Ramos',  username: 'theoramos', hue: 205, queue: 9,  fromYou: 4, fromThem: 5 },
  { id: 'jules', name: 'Jules Park',  username: 'julespark',  hue: 158, queue: 22, fromYou: 8, fromThem: 7 },
  { id: 'sam',   name: 'Sam Okafor',  username: 'samok',      hue: 42,  queue: 6,  fromYou: 2, fromThem: 4 },
];
const FRIEND_MAP = Object.fromEntries(FRIENDS.map(f => [f.id, f]));
const INCOMING = [
  { id: 'devin', name: 'Devin Cho',  username: 'devincho', hue: 280, mutual: 3 },
];
const SENT_PENDING = [
  { id: 'ana', name: 'Ana Reyes', username: 'anareyes', hue: 14 },
];
const SEARCH_POOL = [
  { id: 'noor', name: 'Noor Haddad', username: 'noorhaddad', hue: 100 },
  { id: 'leo',  name: 'Leo Fontaine', username: 'leofon',    hue: 240 },
  { id: 'priya',name: 'Priya Nair',  username: 'priyanair',  hue: 20 },
];

/* ── Queued Bot picks (served one at a time) ──────────────────────────── */
const BOT_PICKS = [
  { id: 'bot-tv-1', type: 'tv', title: 'The Leftovers', creator: 'Season 1', year: 2014,
    reason: 'You rated Severance and Shōgun highly — this shares their slow-burn, character-first tension and lands on a platform you have.' },
  { id: 'bot-mv-1', type: 'movie', title: 'A Separation', creator: 'Asghar Farhadi', year: 2011,
    reason: 'You finished Anatomy of a Fall and The Zone of Interest — another moral pressure-cooker drama, widely considered a high point of the form.' },
  { id: 'bot-mv-2', type: 'movie', title: 'Drive My Car', creator: 'Ryūsuke Hamaguchi', year: 2021,
    reason: 'Patient, literary, and quietly devastating — close to the Past Lives register you queued.' },
];

/* ── Discover / trending (placeholder cover art) ──────────────────────── */
const TRENDING = {
  movie: [
    { id: 'tr-m1', type: 'movie', title: 'The Brutalist',  creator: 'Brady Corbet',   year: 2024 },
    { id: 'tr-m2', type: 'movie', title: 'Nickel Boys',    creator: 'RaMell Ross',    year: 2024 },
    { id: 'tr-m3', type: 'movie', title: 'Conclave',       creator: 'Edward Berger',  year: 2024, queued: true },
    { id: 'tr-m4', type: 'movie', title: 'Challengers',    creator: 'Luca Guadagnino',year: 2024, rating: 8 },
    { id: 'tr-m5', type: 'movie', title: 'The Substance',  creator: 'Coralie Fargeat',year: 2024 },
    { id: 'tr-m6', type: 'movie', title: 'Flow',           creator: 'Gints Zilbalodis',year: 2024 },
  ],
  tv: [
    { id: 'tr-t1', type: 'tv', title: 'Shrinking',    creator: 'Season 2', year: 2024 },
    { id: 'tr-t2', type: 'tv', title: 'Disclaimer',   creator: 'Limited',  year: 2024 },
    { id: 'tr-t3', type: 'tv', title: 'Industry',     creator: 'Season 3', year: 2024, queued: true },
    { id: 'tr-t4', type: 'tv', title: 'Agatha All Along', creator: 'Limited', year: 2024 },
    { id: 'tr-t5', type: 'tv', title: 'Bad Sisters',  creator: 'Season 2', year: 2024 },
  ],
  book: [
    { id: 'tr-b1', type: 'book', title: 'Intermezzo',          creator: 'Sally Rooney',   year: 2024 },
    { id: 'tr-b2', type: 'book', title: 'Martyr!',             creator: 'Kaveh Akbar',    year: 2024 },
    { id: 'tr-b3', type: 'book', title: 'All Fours',           creator: 'Miranda July',   year: 2024, rating: 9 },
    { id: 'tr-b4', type: 'book', title: 'The Ministry of Time',creator: 'Kaliane Bradley',year: 2024 },
    { id: 'tr-b5', type: 'book', title: 'Creation Lake',       creator: 'Rachel Kushner', year: 2024 },
  ],
  album: [
    { id: 'tr-a1', type: 'album', title: 'Manning Fireworks', creator: 'MJ Lenderman',  year: 2024 },
    { id: 'tr-a2', type: 'album', title: 'Bright Future',     creator: 'Adrianne Lenker',year: 2024, queued: true },
    { id: 'tr-a3', type: 'album', title: 'Romance',           creator: 'Fontaines D.C.', year: 2024 },
    { id: 'tr-a4', type: 'album', title: 'Imaginal Disk',     creator: 'Magdalena Bay',  year: 2024 },
    { id: 'tr-a5', type: 'album', title: 'Tigers Blood',      creator: 'Waxahatchee',    year: 2024, rating: 8 },
  ],
};

/* ── shared lists (recommendations between me & a friend, both ways) ───── */
const ME = { id: 'me', name: 'You' };
function sharedFor(friendId) {
  const base = {
    mara: [
      { id: 's-ma1', type: 'tv',    title: 'Severance',        creator: 'Season 2',     dir: 'in',  status: 'in_progress',    comments: 3 },
      { id: 's-ma2', type: 'movie', title: 'Dune: Part Two',   creator: 'Denis Villeneuve', dir: 'in', status: 'queued',     comments: 1 },
      { id: 's-ma3', type: 'book',  title: 'Demon Copperhead', creator: 'Barbara Kingsolver', dir: 'in', status: 'not_yet_viewed', comments: 0 },
      { id: 's-ma4', type: 'movie', title: 'Aftersun',         creator: 'Charlotte Wells', dir: 'out', status: 'finished', rating: 8, comments: 2 },
      { id: 's-ma5', type: 'album', title: 'Brat',             creator: 'Charli XCX',   dir: 'out', status: 'finished', rating: 9, comments: 4 },
      { id: 's-ma6', type: 'tv',    title: 'Shōgun',           creator: 'Limited',      dir: 'out', status: 'queued',    comments: 0 },
    ],
    theo: [
      { id: 's-th1', type: 'tv',    title: 'The Bear',         creator: 'Season 3',     dir: 'in',  status: 'queued',    comments: 1 },
      { id: 's-th2', type: 'album', title: 'Cowboy Carter',    creator: 'Beyoncé',      dir: 'in',  status: 'in_progress', comments: 2 },
      { id: 's-th3', type: 'movie', title: 'Poor Things',      creator: 'Yorgos Lanthimos', dir: 'out', status: 'not_yet_viewed', comments: 0 },
      { id: 's-th4', type: 'movie', title: 'Anatomy of a Fall',creator: 'Justine Triet',dir: 'out', status: 'finished', rating: 9, comments: 1 },
    ],
    jules: [
      { id: 's-ju1', type: 'book',  title: 'The Bee Sting',    creator: 'Paul Murray',  dir: 'in',  status: 'queued',    comments: 0 },
      { id: 's-ju2', type: 'tv',    title: 'Fallout',          creator: 'Season 1',     dir: 'in',  status: 'finished', rating: 8, comments: 3 },
      { id: 's-ju3', type: 'album', title: 'Hit Me Hard and Soft', creator: 'Billie Eilish', dir: 'in', status: 'finished', rating: 8, comments: 1 },
      { id: 's-ju4', type: 'book',  title: 'Trust',            creator: 'Hernan Diaz',  dir: 'out', status: 'finished', rating: 8, comments: 0 },
    ],
    sam: [
      { id: 's-sa1', type: 'movie', title: 'Past Lives',       creator: 'Celine Song',  dir: 'out', status: 'queued',    comments: 1 },
      { id: 's-sa2', type: 'tv',    title: 'Ripley',           creator: 'Limited',      dir: 'in',  status: 'not_yet_viewed', comments: 0 },
    ],
  };
  return base[friendId] || [];
}

/* ── Avatar (gradient ring) ───────────────────────────────────────────── */
function Avatar({ name, hue = 158, size = 40 }) {
  const init = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const pad = Math.max(2, Math.round(size * 0.055));
  return (
    <div style={{ width: size, height: size, borderRadius: 99, padding: pad, background: 'linear-gradient(135deg, #F4E9D1, #D8A84A, #B87333)', flexShrink: 0 }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, hsl(${hue},42%,72%), #F4E9D1)`, color: C.ink, fontFamily: SANS, fontWeight: 800, fontSize: size * 0.34 }}>{init}</div>
    </div>
  );
}

/* ── big screen title ─────────────────────────────────────────────────── */
function ScreenHeader({ title, subtitle, right }) {
  return (
    <div style={{ padding: '52px 18px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 3, color: C.brass, fontWeight: 600, textTransform: 'uppercase' }}>Queued</div>
        <div style={{ fontFamily: SANS, fontSize: 28, fontWeight: 800, color: C.creamText, lineHeight: 1.08, marginTop: 2 }}>{title}</div>
        {subtitle && <div style={{ fontFamily: SANS, fontSize: 12.5, color: G.textFaint, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function SectionTitle({ children, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 11px' }}>
      <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: G.textFaint, fontWeight: 600 }}>{children}</span>
      {count != null && <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.gold }}>{count}</span>}
      <span style={{ flex: 1, height: 1, background: G.rowLine }} />
    </div>
  );
}

function SearchField({ value, onChange, placeholder, autoFocus }) {
  return (
    <div style={{ position: 'relative' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
        <circle cx="11" cy="11" r="8" stroke={C.cream} strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke={C.cream} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', background: 'rgba(2,17,12,0.7)', border: `1.5px solid ${G.panelLine}`, color: C.creamText, borderRadius: 14, padding: '12px 14px 12px 40px', fontSize: 14, fontFamily: SANS, outline: 'none' }} />
    </div>
  );
}

function EmptyState({ title, body, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '34px 22px', background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 20 }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(45,212,143,0.12)', border: `1px solid ${G.panelLine}` }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h9" stroke={C.mint} strokeWidth="2" strokeLinecap="round" /></svg>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 14.5, color: C.creamText, fontWeight: 700 }}>{title}</div>
      {body && <div style={{ fontFamily: SANS, fontSize: 12.5, color: G.textFaint, marginTop: 5, maxWidth: 240, marginInline: 'auto' }}>{body}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

/* ── nav-aware bottom bar ─────────────────────────────────────────────── */
function AppBottomNav({ active, onNav }) {
  const Tab = ({ id, label, d }) => {
    const on = active === id;
    return (
      <button onClick={() => onNav(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 0, opacity: on ? 1 : 0.72 }}>
        <span style={{ width: 38, height: 38, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? C.cream : 'rgba(6,40,28,0.7)', border: on ? 'none' : `1px solid ${G.panelLine}` }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">{d(on ? C.ink : C.cream)}</svg>
        </span>
        <span style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: on ? C.creamText : G.textFaint }}>{label}</span>
      </button>
    );
  };
  return (
    <div style={{ padding: '8px 16px calc(18px + env(safe-area-inset-bottom))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(4,26,18,0.9)', backdropFilter: 'blur(20px)', border: `1px solid ${G.panelLine}`, borderRadius: 26, padding: '10px 20px', boxShadow: '0 18px 40px rgba(0,0,0,0.4)' }}>
        <Tab id="friends" label="Friends" d={c => <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={c} strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke={c} strokeWidth="2" /></>} />
        <Tab id="discover" label="Discover" d={c => <><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2" /><polygon points="16.2,7.8 14.1,14.1 7.8,16.2 9.9,9.9" stroke={c} strokeWidth="2" strokeLinejoin="round" /></>} />
        <button onClick={() => onNav('recommend')} style={{ cursor: 'pointer', width: 50, height: 50, borderRadius: 99, marginTop: -22, background: 'linear-gradient(135deg, #C96B4B, #B87333)', border: `1px solid ${G.heroBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.35)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#FFF8E8" strokeWidth="2.5" strokeLinecap="round" /></svg>
        </button>
        <Tab id="discover2" label="Search" d={c => <><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="2" /><path d="M21 21l-4-4" stroke={c} strokeWidth="2" strokeLinecap="round" /></>} />
        <Tab id="profile" label="Profile" d={c => <><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="2" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="2" strokeLinecap="round" /></>} />
      </div>
    </div>
  );
}

Object.assign(window, {
  G, BOT_ID, FRIENDS, FRIEND_MAP, INCOMING, SENT_PENDING, SEARCH_POOL, BOT_PICKS, TRENDING, ME, sharedFor,
  Avatar, ScreenHeader, SectionTitle, SearchField, EmptyState, AppBottomNav,
});
