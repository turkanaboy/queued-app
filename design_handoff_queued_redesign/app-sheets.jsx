// app-sheets.jsx — RatingSheet, AddTitleSheet, RecommendSheet.
// All use the shared bottom-sheet shell (Sheet) and the green language (G).

/* search catalog = everything we know about, de-duped by title */
function buildCatalog() {
  const seen = new Set();
  const out = [];
  const push = (it) => { const k = it.title.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(it); } };
  DATA.forEach(push);
  Object.values(TRENDING).forEach(arr => arr.forEach(push));
  [
    { id: 'x1', type: 'movie', title: 'In the Mood for Love', creator: 'Wong Kar-wai', year: 2000 },
    { id: 'x2', type: 'tv',    title: 'The Wire',            creator: 'Complete',      year: 2002 },
    { id: 'x3', type: 'book',  title: 'A Little Life',        creator: 'Hanya Yanagihara', year: 2015 },
    { id: 'x4', type: 'album', title: 'Blonde',               creator: 'Frank Ocean',   year: 2016 },
    { id: 'x5', type: 'movie', title: 'Portrait of a Lady on Fire', creator: 'Céline Sciamma', year: 2019 },
  ].forEach(push);
  return out;
}
const CATALOG = buildCatalog();

const TYPE_FILTERS = [['all', 'All'], ['movie', 'Movies'], ['tv', 'TV'], ['book', 'Books'], ['album', 'Albums']];

function TypePills({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
      {TYPE_FILTERS.map(([k, lbl]) => {
        const on = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            cursor: 'pointer', padding: '6px 12px', borderRadius: 999, fontFamily: SANS, fontSize: 12, fontWeight: 700,
            background: on ? C.cream : G.chipBg, border: on ? `1px solid ${C.gold}` : `1px solid ${G.panelLine}`, color: on ? C.ink : G.textDim,
          }}>{lbl}</button>
        );
      })}
    </div>
  );
}

function ResultRow({ item, onPick }) {
  return (
    <button onClick={() => onPick(item)} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer', textAlign: 'left',
      background: 'none', border: 'none', borderRadius: 12, padding: '8px 8px',
    }}>
      <Poster item={item} w={34} h={48} radius={7} glyph={false} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: C.creamText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
        <div style={{ fontFamily: SANS, fontSize: 11.5, color: G.textFaint, marginTop: 1, textTransform: 'capitalize' }}>{item.creator} · {MEDIA[item.type].singular} · {item.year}</div>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={G.panelLine} strokeWidth="1.6" /><path d="M12 8v8M8 12h8" stroke={C.cream} strokeWidth="1.8" strokeLinecap="round" /></svg>
    </button>
  );
}

/* ── 1–10 rating control ──────────────────────────────────────────────── */
function RatingPips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const on = value && n <= value;
        return (
          <button key={n} onClick={() => onChange(n === value ? null : n)} style={{
            flex: 1, height: 30, borderRadius: 7, cursor: 'pointer', border: 'none',
            background: on ? 'linear-gradient(180deg, #E7C674, #C99A52)' : 'rgba(2,17,12,0.5)',
            boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,0.3)' : `inset 0 0 0 1px ${G.panelLine}`,
            color: on ? C.ink : G.textFaint, fontFamily: MONO, fontSize: 11, fontWeight: 600,
          }}>{n}</button>
        );
      })}
    </div>
  );
}

function RatingSheet({ item, onClose, onSave }) {
  const [rating, setRating] = React.useState(item?.rating || null);
  const [review, setReview] = React.useState(item?.review || '');
  if (!item) return null;
  return (
    <Sheet open={!!item} onClose={onClose} title="Rate & finish">
      <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
        <Poster item={item} w={56} h={80} radius={10} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 800, color: C.creamText, lineHeight: 1.2 }}>{item.title}</div>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: G.textDim, marginTop: 4 }}>{item.creator} · {item.year}</div>
          {rating && <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 20, fontWeight: 600, color: C.gold }}>★ {rating}.0<span style={{ color: G.textFaint, fontSize: 12 }}> / 10</span></div>}
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: G.textFaint, marginBottom: 9 }}>Your rating</div>
      <RatingPips value={rating} onChange={setRating} />
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: G.textFaint, margin: '18px 0 9px' }}>Note <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
      <textarea value={review} onChange={e => setReview(e.target.value.slice(0, 280))} rows={2} placeholder="What did you think?"
        style={{ width: '100%', resize: 'none', background: 'rgba(2,17,12,0.6)', border: `1.5px solid ${G.panelLine}`, color: C.creamText, borderRadius: 14, padding: '11px 13px', fontSize: 13.5, fontFamily: SANS, outline: 'none' }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={() => onSave(rating, review)} disabled={!rating} style={{ ...solidBtn, opacity: rating ? 1 : 0.4 }}>Mark finished</button>
      </div>
    </Sheet>
  );
}

/* ── add a title to my queue ──────────────────────────────────────────── */
function AddTitleSheet({ open, onClose, onAdd, onFinish }) {
  const [type, setType] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [picked, setPicked] = React.useState(null);
  React.useEffect(() => { if (!open) { setType('all'); setQ(''); setPicked(null); } }, [open]);

  const results = CATALOG.filter(i =>
    (type === 'all' || i.type === type) &&
    (q.trim().length < 1 || (i.title + ' ' + i.creator).toLowerCase().includes(q.toLowerCase()))
  ).slice(0, 24);

  return (
    <Sheet open={open} onClose={onClose} title={picked ? 'Add to queue' : 'Add a title'}>
      {!picked ? (
        <div>
          <TypePills value={type} onChange={setType} />
          <SearchField value={q} onChange={setQ} placeholder="Search movies, TV, books, albums…" autoFocus />
          <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, fontFamily: SANS, color: G.textFaint, fontSize: 13 }}>No matches.</div>
            ) : results.map(it => <ResultRow key={it.id} item={it} onPick={setPicked} />)}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 14 }}>
            <Poster item={picked} w={64} h={92} radius={11} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 800, color: C.creamText, lineHeight: 1.2 }}>{picked.title}</div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: G.textDim, marginTop: 4, textTransform: 'capitalize' }}>{picked.creator} · {MEDIA[picked.type].singular} · {picked.year}</div>
              <button onClick={() => setPicked(null)} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: C.gold, fontFamily: SANS, fontSize: 12.5, fontWeight: 700, padding: 0 }}>← Pick another</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => onFinish(picked)} style={ghostBtn}>I've finished it</button>
            <button onClick={() => onAdd(picked)} style={solidBtn}>Add to queue</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ── recommend a title to a friend (+ FAB) ────────────────────────────── */
function RecommendSheet({ open, onClose, onSend }) {
  const [friend, setFriend] = React.useState(null);
  const [type, setType] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [picked, setPicked] = React.useState(null);
  const [note, setNote] = React.useState('');
  React.useEffect(() => { if (!open) { setFriend(null); setType('all'); setQ(''); setPicked(null); setNote(''); } }, [open]);

  const results = CATALOG.filter(i =>
    (type === 'all' || i.type === type) &&
    (q.trim().length < 1 || (i.title + ' ' + i.creator).toLowerCase().includes(q.toLowerCase()))
  ).slice(0, 20);

  return (
    <Sheet open={open} onClose={onClose} title="Recommend a title">
      {/* who */}
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: G.textFaint, marginBottom: 10 }}>To</div>
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6, marginBottom: 14, scrollbarWidth: 'none' }}>
        {FRIENDS.map(f => {
          const on = friend === f.id;
          return (
            <button key={f.id} onClick={() => setFriend(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 0, flexShrink: 0, opacity: on ? 1 : 0.6 }}>
              <div style={{ borderRadius: 99, padding: 2, background: on ? 'rgba(45,212,143,0.5)' : 'transparent' }}>
                <Avatar name={f.name} hue={f.hue} size={46} />
              </div>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: on ? C.creamText : G.textFaint }}>{f.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {!picked ? (
        <div>
          <TypePills value={type} onChange={setType} />
          <SearchField value={q} onChange={setQ} placeholder="Search a title to send…" />
          <div style={{ marginTop: 12, maxHeight: 210, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {results.map(it => <ResultRow key={it.id} item={it} onPick={setPicked} />)}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 13, alignItems: 'center', background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 14, padding: 10 }}>
            <Poster item={picked} w={40} h={58} radius={8} glyph={false} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 800, color: C.creamText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{picked.title}</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: G.textDim, marginTop: 2 }}>{picked.creator}</div>
            </div>
            <button onClick={() => setPicked(null)} style={{ background: 'none', border: 'none', color: G.textFaint, cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 200))} rows={2} placeholder="Add a note (optional)…"
            style={{ width: '100%', resize: 'none', marginTop: 12, background: 'rgba(2,17,12,0.6)', border: `1.5px solid ${G.panelLine}`, color: C.creamText, borderRadius: 14, padding: '11px 13px', fontSize: 13.5, fontFamily: SANS, outline: 'none' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={() => onSend(FRIEND_MAP[friend], picked)} disabled={!friend || !picked} style={{ ...solidBtn, opacity: friend && picked ? 1 : 0.4 }}>
          {friend ? `Send to ${FRIEND_MAP[friend].name.split(' ')[0]}` : 'Send'}
        </button>
      </div>
    </Sheet>
  );
}

const ghostBtn = { flex: '0 0 auto', cursor: 'pointer', padding: '12px 18px', borderRadius: 14, background: 'rgba(2,17,12,0.5)', border: `1px solid ${G.panelLine}`, color: G.textDim, fontFamily: SANS, fontWeight: 700, fontSize: 14 };
const solidBtn = { flex: 1, cursor: 'pointer', padding: '12px 18px', borderRadius: 14, background: C.cream, border: `1px solid ${C.gold}`, color: C.ink, fontFamily: SANS, fontWeight: 800, fontSize: 14, boxShadow: '0 6px 0 rgba(184,115,51,0.32)' };

Object.assign(window, { CATALOG, RatingSheet, AddTitleSheet, RecommendSheet });
