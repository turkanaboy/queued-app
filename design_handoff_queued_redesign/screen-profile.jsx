// screen-profile.jsx — ProfileScreen (full build-out of Option B).
// Props: { store }  where store = the app-level queue store.
const { useState: useSP, useEffect: useEP } = React;

function ProfileScreen({ store }) {
  const { queue, addToQueue, setStatus, setRating,
          botThinking, botActive, botRec, botReason, askBot, dismissBotReason } = store;

  const [medium, setMedium] = useSP('movie');
  const [expanded, setExpanded] = useSP(false);
  const [statusFilter, setStatusFilter] = useSP('all');
  const [showChips, setShowChips] = useSP(false);
  const [addOpen, setAddOpen] = useSP(false);
  const [ratingItem, setRatingItem] = useSP(null);
  const [toast, setToast] = useSP('');

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2200); }
  function handleAddToQueue(item) {
    addToQueue({ ...item, status: 'queued', origin: { type: 'self' } });
    setAddOpen(false);
    flash(`${item.title} added to queue`);
  }
  function handleFinish(item) {
    setAddOpen(false);
    setRatingItem({ ...item, origin: { type: 'self' }, status: 'finished' });
  }
  function handleSaveRating(item, rating, review) {
    if (!queue.find(i => i.id === item.id)) {
      addToQueue({ ...item, status: 'finished', origin: { type: 'self' }, rating, review });
    } else {
      setRating(item.id, rating, review);
    }
    setRatingItem(null);
    flash(`Saved — ★${rating} for ${item.title}`);
  }

  const mediumItems = queue.filter(i => i.type === medium);
  const stats = computeStats(mediumItems);
  const items = mediumItems.filter(i => statusFilter === 'all' || i.status === statusFilter);
  const counts = Object.fromEntries(MEDIA_ORDER.map(k => [k, queue.filter(i => i.type === k).length]));
  const segs = STATUS_ORDER.map(s => ({ s, n: stats.byStatus[s] })).filter(d => d.n > 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: G.bg, color: C.creamText, fontFamily: SANS, position: 'relative' }}>

      {/* ── header ── */}
      <div style={{ padding: '52px 18px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 3, color: C.brass, fontWeight: 600, textTransform: 'uppercase' }}>Queued</div>
          <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 800, color: C.creamText, lineHeight: 1.1, marginTop: 2 }}>My Queue</div>
        </div>
        <Avatar name="Alex Reyes" hue={158} size={42} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px calc(16px + env(safe-area-inset-bottom))' }}>

        {/* medium tabs */}
        <div style={{ background: G.tabBar, borderRadius: 18, padding: 3, border: `1px solid ${G.panelLine}`, boxShadow: 'inset 0 1px 0 rgba(190,236,210,0.06)' }}>
          <MediumTabs value={medium} onChange={(m) => { setMedium(m); setStatusFilter('all'); setExpanded(false); }} counts={counts} />
        </div>

        {/* hero expandable stat */}
        <div style={{ marginTop: 14, background: G.hero, border: `1px solid ${G.heroBorder}`, borderRadius: 22, overflow: 'hidden', boxShadow: '0 18px 40px rgba(2,16,11,0.45), inset 0 1px 0 rgba(190,236,210,0.10)' }}>
          <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', cursor: 'pointer', background: 'none', border: 'none', padding: '15px 16px 14px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: -10, top: -8, width: 64, height: 64, borderRadius: 99, background: 'radial-gradient(circle, rgba(45,212,143,0.32), transparent 68%)', filter: 'blur(4px)', pointerEvents: 'none' }} />
                  <span style={{ fontFamily: MONO, fontSize: 36, fontWeight: 600, color: C.creamText, lineHeight: 1, position: 'relative' }}>{stats.active}</span>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: G.textDim, fontWeight: 600, position: 'relative' }}>in your {MEDIA[medium].label.toLowerCase()} queue</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <ProfileMiniStat label="Finished" value={stats.finished} tone={C.mint} />
                  <ProfileMiniStat label="Avg" value={stats.avg ? '★' + stats.avg : '—'} tone={C.gold} />
                  <ProfileMiniStat label="From friends" value={stats.fromFriends} tone={C.gold} />
                </div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: SANS, fontSize: 11, fontWeight: 700, color: C.gold, flexShrink: 0 }}>
                {expanded ? 'Less' : 'Breakdown'}
                <svg width="11" height="8" viewBox="0 0 11 8" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M1.5 2l4 4 4-4" stroke={C.gold} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 14, height: 8, padding: 2, background: G.track, borderRadius: 6 }}>
              {segs.length ? segs.map(d => (
                <div key={d.s} title={STATUS[d.s].label} style={{ flex: d.n, background: STATUS[d.s].dot, borderRadius: 3, opacity: statusFilter === 'all' || statusFilter === d.s ? 1 : 0.25, transition: 'opacity .2s' }} />
              )) : <div style={{ flex: 1, background: G.panelLine, borderRadius: 3 }} />}
            </div>
          </button>

          <div style={{ maxHeight: expanded ? 380 : 0, overflow: 'hidden', transition: 'max-height .3s ease' }}>
            <div style={{ padding: '4px 10px 14px', borderTop: `1px solid ${G.panelLine}` }}>
              {STATUS_ORDER.map(s => {
                const n = stats.byStatus[s];
                const active = statusFilter === s;
                return (
                  <button key={s} onClick={() => setStatusFilter(active ? 'all' : s)} disabled={!n} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 11, cursor: n ? 'pointer' : 'default',
                    background: active ? 'rgba(45,212,143,0.12)' : 'transparent', border: 'none', borderRadius: 11, padding: '9px 10px', opacity: n ? 1 : 0.32,
                    boxShadow: active ? 'inset 2px 0 0 rgba(45,212,143,0.7)' : 'none',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: STATUS[s].dot }} />
                    <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: C.creamText, flex: 1, textAlign: 'left' }}>{STATUS[s].label}</span>
                    <span style={{ width: 80, height: 5, borderRadius: 99, background: G.track, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${stats.total ? (n / stats.total) * 100 : 0}%`, background: STATUS[s].dot, borderRadius: 99 }} />
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.creamText, width: 22, textAlign: 'right' }}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── bot strip ── */}
        <BotStrip
          thinking={botThinking} active={botActive} rec={botRec} reason={botReason}
          medium={medium}
          onAsk={askBot}
          onDismiss={dismissBotReason}
          onStatus={(id, s) => { setStatus(id, s); if (!ACTIVE_STATUSES.includes(s)) dismissBotReason(); }}
        />

        {/* controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 10px' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: G.textFaint, letterSpacing: 0.4 }}>
            {items.length} {items.length === 1 ? 'title' : 'titles'}{statusFilter !== 'all' ? ` · ${STATUS[statusFilter].label}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowChips(v => !v)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
              background: showChips ? C.cream : G.ctrlBg, border: `1px solid ${showChips ? C.gold : G.panelLine}`,
              borderRadius: 999, padding: '7px 13px', color: showChips ? C.ink : C.creamText, fontFamily: SANS, fontSize: 12.5, fontWeight: 700,
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M4.5 8h7M6.5 12h3" stroke={showChips ? C.ink : C.cream} strokeWidth="1.6" strokeLinecap="round" /></svg>
              Status
            </button>
            <button onClick={() => setAddOpen(true)} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: 35, height: 35,
              background: 'linear-gradient(135deg, #C96B4B, #B87333)', border: 'none', borderRadius: 999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#FFF8E8" strokeWidth="2.5" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* chips */}
        <div style={{ maxHeight: showChips ? 72 : 0, overflow: 'hidden', transition: 'max-height .25s ease', marginBottom: showChips ? 12 : 0 }}>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {[['all', 'All'], ...STATUS_ORDER.map(s => [s, STATUS[s].label])].map(([k, lbl]) => {
              const on = statusFilter === k;
              return (
                <button key={k} onClick={() => setStatusFilter(k)} style={{
                  flexShrink: 0, cursor: 'pointer', padding: '6px 12px', borderRadius: 999, fontFamily: SANS, fontSize: 12, fontWeight: 700,
                  background: on ? C.cream : G.chipBg, border: on ? `1px solid ${C.gold}` : `1px solid ${G.panelLine}`, color: on ? C.ink : G.textDim,
                }}>{lbl}</button>
              );
            })}
          </div>
        </div>

        {/* list */}
        {mediumItems.length === 0 ? (
          <EmptyState title={`No ${MEDIA[medium].label.toLowerCase()} yet`}
            body="Add something from the Discover tab, or use the + button."
            action={<button onClick={() => setAddOpen(true)} style={{ cursor: 'pointer', background: C.cream, border: `1px solid ${C.gold}`, borderRadius: 999, padding: '8px 18px', fontFamily: SANS, fontWeight: 800, fontSize: 13, color: C.ink, boxShadow: '0 5px 0 rgba(184,115,51,0.3)' }}>+ Add a title</button>} />
        ) : items.length === 0 ? (
          <EmptyState title="Nothing matches" body={`No ${MEDIA[medium].label.toLowerCase()} with that status.`}
            action={<button onClick={() => setStatusFilter('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gold, fontFamily: SANS, fontWeight: 700, fontSize: 13 }}>Clear filter</button>} />
        ) : (
          <div style={{ background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 18, overflow: 'hidden', boxShadow: `inset 3px 0 0 ${G.spine}` }}>
            {items.map((item, i) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px',
                borderTop: i ? `1px solid ${G.rowLine}` : 'none',
              }}>
                <button onClick={() => setRatingItem(item)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                  <Poster item={item} w={36} h={52} radius={8} glyph={false} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: C.creamText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                    {item.rating && <Rating value={item.rating} />}
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 11.5, color: G.textFaint, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.creator} · {originLabel(item.origin)}
                    {item.origin.type === 'bot' && <span style={{ marginLeft: 4, color: C.terra }}>· Bot</span>}
                  </div>
                </div>
                <StatusMenu value={item.status} onChange={(s) => setStatus(item.id, s)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* toast */}
      {toast && (
        <div style={{ position: 'absolute', bottom: 110, left: 18, right: 18, zIndex: 80, background: 'rgba(8,48,33,0.96)', border: `1px solid ${G.panelLine}`, borderRadius: 14, padding: '12px 16px', fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: C.creamText, textAlign: 'center', backdropFilter: 'blur(10px)', boxShadow: '0 14px 30px rgba(0,0,0,0.4)', animation: 'qFade .2s ease' }}>
          {toast}
        </div>
      )}

      {/* sheets */}
      <AddTitleSheet open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddToQueue} onFinish={handleFinish} />
      {ratingItem && <RatingSheet item={ratingItem} onClose={() => setRatingItem(null)} onSave={(rating, review) => handleSaveRating(ratingItem, rating, review)} />}
    </div>
  );
}

function BotStrip({ thinking, active, rec, reason, onAsk, onDismiss, onStatus, medium = 'movie' }) {
  if (thinking) {
    return (
      <div style={{ margin: '14px 0 0', background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 16, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 32, height: 32, borderRadius: 99, background: 'rgba(45,212,143,0.15)', border: `1px solid ${C.mint}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={C.mint} strokeWidth="2" strokeDasharray="28 10" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" /></circle></svg>
        </div>
        <span style={{ fontFamily: SANS, fontSize: 13.5, color: G.textDim, fontWeight: 600 }}>Queued Bot is thinking…</span>
      </div>
    );
  }

  if (reason && rec) {
    return (
      <div style={{ margin: '14px 0 0', background: 'rgba(12,62,44,0.72)', border: `1px solid ${C.mint}44`, borderRadius: 18, padding: '14px 15px', boxShadow: 'inset 2px 0 0 rgba(45,212,143,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <Poster item={rec} w={50} h={72} radius={10} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.mint, marginBottom: 5 }}>Queued Bot recommends</div>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 800, color: C.creamText }}>{rec.title}</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: G.textDim, marginTop: 2 }}>{rec.creator} · {rec.year}</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: G.textDim, marginTop: 8, lineHeight: 1.5 }}>{reason}</div>
          </div>
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: G.textFaint, cursor: 'pointer', fontSize: 16, padding: '2px 4px', flexShrink: 0 }}>✕</button>
        </div>
        <StatusMenu value={rec.status} onChange={s => onStatus(rec.id, s)} align="left" />
      </div>
    );
  }

  if (active && rec) {
    return (
      <div style={{ margin: '14px 0 0', background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 16, padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 7, height: 7, borderRadius: 99, background: C.gold, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: SANS, fontSize: 12.5, color: G.textDim }}>Bot is waiting on </span>
          <span style={{ fontFamily: SANS, fontSize: 12.5, color: C.creamText, fontWeight: 700 }}>{rec.title}</span>
          <span style={{ fontFamily: SANS, fontSize: 12.5, color: G.textFaint }}> — mark it done for a new pick.</span>
        </div>
      </div>
    );
  }

  return (
    <button onClick={onAsk} style={{ margin: '14px 0 0', width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: `1px dashed rgba(45,212,143,0.35)`, borderRadius: 16, padding: '12px 16px', cursor: 'pointer' }}>
      <div style={{ width: 32, height: 32, borderRadius: 99, background: 'rgba(45,212,143,0.10)', border: `1px solid rgba(45,212,143,0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke={C.mint} strokeWidth="2" strokeLinecap="round" /></svg>
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: C.creamText }}>Ask Queued Bot for a pick</div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: G.textFaint, marginTop: 2 }}>Personalised recommendation for {MEDIA[medium] ? MEDIA[medium].label.toLowerCase() : 'you'}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}><path d="M9 18l6-6-6-6" stroke={G.textFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

function ProfileMiniStat({ label, value, tone }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: tone || C.gold }}>{value}</div>
      <div style={{ fontFamily: SANS, fontSize: 10, color: G.textFaint, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}

Object.assign(window, { ProfileScreen });
