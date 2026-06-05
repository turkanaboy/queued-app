// screen-discover.jsx — DiscoverScreen
const { useState: useDIS } = React;

function DiscoverScreen({ store }) {
  const { queue, addToQueue, setRating: storeRating } = store;
  const [medium, setMedium] = useDIS('movie');
  const [ratingItem, setRatingItem] = useDIS(null);
  const [toast, setToast] = useDIS('');

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2000); }

  function handleQueue(item) {
    if (queue.find(i => i.id === item.id)) return;
    addToQueue({ ...item, status: 'queued', origin: { type: 'self' } });
    flash(`${item.title} added to queue`);
  }

  function handleRateSave(item, rating) {
    const exists = queue.find(i => i.id === item.id);
    if (exists) {
      storeRating(item.id, rating);
    } else {
      addToQueue({ ...item, status: 'finished', origin: { type: 'self' }, rating });
    }
    setRatingItem(null);
    flash(`Saved ★${rating} for ${item.title}`);
  }

  const counts = Object.fromEntries(MEDIA_ORDER.map(k => [k, TRENDING[k].length]));
  const items = TRENDING[medium];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: G.bg, color: C.creamText, fontFamily: SANS, position: 'relative' }}>
      <ScreenHeader title="Discover" subtitle="Trending now — tap to rate, bookmark to queue" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px calc(16px + env(safe-area-inset-bottom))' }}>

        {/* medium tabs */}
        <div style={{ background: G.tabBar, borderRadius: 18, padding: 3, border: `1px solid ${G.panelLine}`, boxShadow: 'inset 0 1px 0 rgba(190,236,210,0.06)', marginBottom: 18 }}>
          <MediumTabs value={medium} onChange={setMedium} counts={counts} />
        </div>

        {/* legend */}
        <div style={{ display: 'flex', gap: 18, marginBottom: 16 }}>
          <LegendItem dot={C.mint} label="In your queue" />
          <LegendItem dot={C.gold} label="Rated" />
        </div>

        {/* grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {items.map(item => {
            const queued = !!queue.find(i => i.id === item.id && i.status !== 'finished');
            const rated = queue.find(i => i.id === item.id && i.rating);
            const ratingVal = rated?.rating || item.rating;
            return (
              <DiscoverCard key={item.id}
                item={item} queued={queued} rated={!!ratingVal} ratingVal={ratingVal}
                onRate={() => setRatingItem(item)}
                onQueue={() => handleQueue(item)} />
            );
          })}
        </div>

        {/* recently queued */}
        {queue.filter(i => i.type === medium && i.status === 'queued').length > 0 && (
          <div style={{ marginTop: 28 }}>
            <SectionTitle>In your {MEDIA[medium].label.toLowerCase()} queue</SectionTitle>
            <div style={{ background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 18, overflow: 'hidden', boxShadow: `inset 3px 0 0 ${G.spine}` }}>
              {queue.filter(i => i.type === medium && i.status === 'queued').map((item, i, arr) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderTop: i ? `1px solid ${G.rowLine}` : 'none' }}>
                  <Poster item={item} w={34} h={48} radius={7} glyph={false} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: C.creamText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                    <div style={{ fontFamily: SANS, fontSize: 11.5, color: G.textFaint, marginTop: 2 }}>{item.creator}</div>
                  </div>
                  <button onClick={() => setRatingItem(item)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: G.chipBg, border: `1px solid ${G.panelLine}`, fontFamily: SANS, fontSize: 12, fontWeight: 700, color: C.gold }}>
                    ★ Rate
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'absolute', bottom: 110, left: 18, right: 18, zIndex: 80, background: 'rgba(8,48,33,0.96)', border: `1px solid ${G.panelLine}`, borderRadius: 14, padding: '12px 16px', fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: C.creamText, textAlign: 'center', backdropFilter: 'blur(10px)', animation: 'qFade .2s ease' }}>{toast}</div>
      )}

      {ratingItem && (
        <RatingSheet item={ratingItem} onClose={() => setRatingItem(null)} onSave={(rating) => handleRateSave(ratingItem, rating)} />
      )}
    </div>
  );
}

function DiscoverCard({ item, queued, rated, ratingVal, onRate, onQueue }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative' }}>
        <button onClick={onRate} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%' }}>
          <Poster item={item} w="100%" h={120} radius={12} />
          {ratingVal && (
            <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 999, background: 'rgba(2,12,8,0.82)', backdropFilter: 'blur(4px)' }}>
              <span style={{ color: C.gold, fontSize: 9 }}>★</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.creamText, fontWeight: 600 }}>{ratingVal}</span>
            </div>
          )}
        </button>
        <button onClick={onQueue} disabled={queued} style={{
          position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 99, cursor: queued ? 'default' : 'pointer', border: 'none',
          background: queued ? 'rgba(45,212,143,0.7)' : 'rgba(2,12,8,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {queued
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
          }
        </button>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color: C.creamText, marginTop: 7, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
      <div style={{ fontFamily: SANS, fontSize: 10.5, color: G.textFaint, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.creator}</div>
    </div>
  );
}

function LegendItem({ dot, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: dot }} />
      <span style={{ fontFamily: SANS, fontSize: 11.5, color: G.textFaint }}>{label}</span>
    </div>
  );
}

Object.assign(window, { DiscoverScreen });
