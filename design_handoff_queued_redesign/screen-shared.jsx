// screen-shared.jsx — SharedListScreen (recs between me & a friend, both ways)
const { useState: useSL, useMemo: useMemoSL } = React;

function SharedListScreen({ friend, onBack }) {
  const [typeFilter, setTypeFilter] = useSL('all');
  const [dirFilter, setDirFilter] = useSL('all');
  const [statusFilter, setStatusFilter] = useSL('all');
  const [overrides, setOverrides] = useSL({});
  const [ratingItem, setRatingItem] = useSL(null);
  const [toast, setToast] = useSL('');

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2000); }
  function setStatus(id, s) { setOverrides(o => ({ ...o, [id]: { ...o[id], status: s } })); }
  function setRating(id, r) { setOverrides(o => ({ ...o, [id]: { ...o[id], rating: r, status: 'finished' } })); flash('Rating saved'); }

  const allRecs = useMemoSL(() => sharedFor(friend.id).map(r => ({ ...r, ...overrides[r.id] })), [friend.id, overrides]);
  const filtered = allRecs.filter(r =>
    (typeFilter === 'all' || r.type === typeFilter) &&
    (dirFilter === 'all' || r.dir === dirFilter) &&
    (statusFilter === 'all' || r.status === statusFilter)
  );
  const stats = { total: allRecs.length, finished: allRecs.filter(r => r.status === 'finished').length, fromYou: allRecs.filter(r => r.dir === 'out').length, fromThem: allRecs.filter(r => r.dir === 'in').length };

  const TYPE_OPTIONS = [['all', 'All'], ['movie', 'Films'], ['tv', 'TV'], ['book', 'Books'], ['album', 'Albums']];
  const DIR_OPTIONS  = [['all', 'All'], ['in', 'From them'], ['out', 'From you']];
  const STAT_OPTIONS = [['all', 'All'], ['not_yet_viewed', 'New'], ['queued', 'Queued'], ['in_progress', 'Watching'], ['finished', 'Finished']];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: G.bg, color: C.creamText, fontFamily: SANS, position: 'relative' }}>

      {/* header */}
      <div style={{ padding: '52px 18px 12px', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <button onClick={onBack} style={{ background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 12, padding: '8px 12px', cursor: 'pointer', color: C.creamText, fontFamily: SANS, fontWeight: 700, fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <svg width="10" height="16" viewBox="0 0 10 16"><path d="M8 2L2 8l6 6" stroke={C.cream} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 3, color: C.brass, fontWeight: 600, textTransform: 'uppercase' }}>Shared list</div>
          <div style={{ fontFamily: SANS, fontSize: 24, fontWeight: 800, color: C.creamText, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{friend.name}</div>
        </div>
        <Avatar name={friend.name} hue={friend.hue} size={40} />
      </div>

      {/* summary pills */}
      <div style={{ padding: '0 18px 14px', display: 'flex', gap: 9 }}>
        {[
          { label: 'Total', value: stats.total },
          { label: 'Finished', value: stats.finished, tone: C.mint },
          { label: 'From them', value: stats.fromThem, tone: C.gold },
          { label: 'From you', value: stats.fromYou, tone: C.gold },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 13, padding: '9px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: s.tone || C.creamText }}>{s.value}</div>
            <div style={{ fontFamily: SANS, fontSize: 10, color: G.textFaint, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px calc(16px + env(safe-area-inset-bottom))' }}>

        {/* filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <FilterChips options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
          <FilterChips options={DIR_OPTIONS} value={dirFilter} onChange={setDirFilter} />
          <FilterChips options={STAT_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </div>

        {/* count */}
        <div style={{ fontFamily: MONO, fontSize: 11, color: G.textFaint, letterSpacing: 0.4, marginBottom: 10 }}>
          {filtered.length} {filtered.length === 1 ? 'title' : 'titles'}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Nothing matches" body="Try adjusting your filters." action={<button onClick={() => { setTypeFilter('all'); setDirFilter('all'); setStatusFilter('all'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gold, fontFamily: SANS, fontWeight: 700, fontSize: 13 }}>Clear filters</button>} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(rec => (
              <SharedRecCard key={rec.id} rec={rec} friend={friend}
                onStatus={s => setStatus(rec.id, s)}
                onRate={() => setRatingItem(rec)} />
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'absolute', bottom: 110, left: 18, right: 18, zIndex: 80, background: 'rgba(8,48,33,0.96)', border: `1px solid ${G.panelLine}`, borderRadius: 14, padding: '12px 16px', fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: C.creamText, textAlign: 'center', animation: 'qFade .2s ease' }}>{toast}</div>
      )}

      {ratingItem && (
        <RatingSheet item={ratingItem} onClose={() => setRatingItem(null)} onSave={(rating) => { setRating(ratingItem.id, rating); setRatingItem(null); }} />
      )}
    </div>
  );
}

function SharedRecCard({ rec, friend, onStatus, onRate }) {
  const isIn = rec.dir === 'in'; // they sent to me
  const dirDot = isIn ? C.gold : C.brass;
  const dirLabel = isIn ? `From ${friend.name.split(' ')[0]}` : 'From you';
  return (
    <div style={{ background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 18, padding: '12px 13px', boxShadow: `inset 3px 0 0 ${isIn ? 'rgba(216,168,74,0.55)' : G.spine}` }}>
      <div style={{ display: 'flex', gap: 13 }}>
        <Poster item={rec} w={52} h={76} radius={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 700, color: C.creamText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.title}</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: G.textDim, marginTop: 2, textTransform: 'capitalize' }}>{rec.creator}</div>
            </div>
            {rec.rating && <Rating value={rec.rating} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: dirDot, flexShrink: 0 }} />
            <span style={{ fontFamily: SANS, fontSize: 11.5, color: G.textFaint }}>{dirLabel}</span>
            {rec.comments > 0 && (
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 10.5, color: G.textFaint }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v13H4z" stroke={G.textFaint} strokeWidth="1.8" rx="3" /><path d="M8 20l4-4" stroke={G.textFaint} strokeWidth="1.8" strokeLinecap="round" /></svg>
                {rec.comments}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
            <StatusMenu value={rec.status} onChange={onStatus} />
            {isIn && rec.status !== 'finished' && (
              <button onClick={onRate} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: G.chipBg, border: `1px solid ${G.panelLine}`, fontFamily: SANS, fontSize: 12, fontWeight: 700, color: C.gold }}>★ Rate</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChips({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {options.map(([k, lbl]) => {
        const on = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            flexShrink: 0, cursor: 'pointer', padding: '6px 12px', borderRadius: 999, fontFamily: SANS, fontSize: 12, fontWeight: 700,
            background: on ? C.cream : G.chipBg, border: on ? `1px solid ${C.gold}` : `1px solid ${G.panelLine}`, color: on ? C.ink : G.textDim,
          }}>{lbl}</button>
        );
      })}
    </div>
  );
}

Object.assign(window, { SharedListScreen });
