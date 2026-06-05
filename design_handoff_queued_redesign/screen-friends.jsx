// screen-friends.jsx — FriendsScreen
const { useState: useFR } = React;

function FriendsScreen({ onViewList }) {
  const [q, setQ] = useFR('');
  const [pendingFriends, setPendingFriends] = useFR([...SENT_PENDING]);
  const [incomingFriends, setIncomingFriends] = useFR([...INCOMING]);
  const [friends, setFriends] = useFR([...FRIENDS]);
  const [toast, setToast] = useFR('');

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2000); }

  const searchResults = q.trim().length >= 2
    ? [...FRIENDS, ...SEARCH_POOL].filter(p =>
        (p.name.toLowerCase() + ' ' + p.username.toLowerCase()).includes(q.toLowerCase()) &&
        !friends.find(f => f.id === p.id) && !pendingFriends.find(f => f.id === p.id)
      )
    : [];

  function sendRequest(person) {
    setPendingFriends(prev => [...prev, person]);
    setQ('');
    flash(`Request sent to ${person.name.split(' ')[0]}`);
  }
  function accept(person) {
    setIncomingFriends(prev => prev.filter(f => f.id !== person.id));
    setFriends(prev => [...prev, { ...person, queue: 4, fromYou: 0, fromThem: 0 }]);
    flash(`${person.name.split(' ')[0]} added`);
  }
  function decline(person) {
    setIncomingFriends(prev => prev.filter(f => f.id !== person.id));
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: G.bg, color: C.creamText, fontFamily: SANS, position: 'relative' }}>
      <ScreenHeader title="Friends" subtitle="Find people & see their recommendations" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px calc(16px + env(safe-area-inset-bottom))' }}>

        {/* search */}
        <SearchField value={q} onChange={setQ} placeholder="Search by name or username…" />

        {searchResults.length > 0 && (
          <div style={{ marginTop: 10, background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 18, overflow: 'hidden', boxShadow: `inset 3px 0 0 ${G.spine}` }}>
            {searchResults.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', borderTop: i ? `1px solid ${G.rowLine}` : 'none' }}>
                <Avatar name={u.name} hue={u.hue} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: C.creamText }}>{u.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: G.textFaint, marginTop: 1 }}>@{u.username}</div>
                </div>
                <button onClick={() => sendRequest(u)} style={{ cursor: 'pointer', background: C.cream, border: `1px solid ${C.gold}`, borderRadius: 999, padding: '7px 15px', fontFamily: SANS, fontSize: 12.5, fontWeight: 800, color: C.ink, boxShadow: '0 4px 0 rgba(184,115,51,0.3)' }}>Add</button>
              </div>
            ))}
          </div>
        )}

        {/* incoming requests */}
        {incomingFriends.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <SectionTitle count={incomingFriends.length}>Requests</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incomingFriends.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(45,212,143,0.08)', border: `1px solid rgba(45,212,143,0.25)`, borderRadius: 18, boxShadow: 'inset 2px 0 0 rgba(45,212,143,0.5)' }}>
                  <Avatar name={f.name} hue={f.hue} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: C.creamText }}>{f.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: G.textFaint }}>@{f.username}{f.mutual ? ` · ${f.mutual} mutual` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => decline(f)} style={{ cursor: 'pointer', background: G.chipBg, border: `1px solid ${G.panelLine}`, borderRadius: 999, padding: '7px 12px', fontFamily: SANS, fontSize: 12, fontWeight: 700, color: G.textDim }}>Decline</button>
                    <button onClick={() => accept(f)} style={{ cursor: 'pointer', background: C.cream, border: `1px solid ${C.gold}`, borderRadius: 999, padding: '7px 14px', fontFamily: SANS, fontSize: 12.5, fontWeight: 800, color: C.ink, boxShadow: '0 4px 0 rgba(184,115,51,0.25)' }}>Accept</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* friends list */}
        <div style={{ marginTop: 22 }}>
          <SectionTitle count={friends.length}>Your friends</SectionTitle>
          {friends.length === 0 ? (
            <EmptyState title="No friends yet" body="Search for someone by username to add them." />
          ) : (
            <div style={{ background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 18, overflow: 'hidden', boxShadow: `inset 3px 0 0 ${G.spine}` }}>
              {friends.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderTop: i ? `1px solid ${G.rowLine}` : 'none' }}>
                  <Avatar name={f.name} hue={f.hue} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: C.creamText }}>{f.name}</div>
                    <div style={{ fontFamily: SANS, fontSize: 11.5, color: G.textFaint, marginTop: 2, display: 'flex', gap: 10 }}>
                      <span>{f.queue} in queue</span>
                      <span style={{ color: G.rowLine }}>|</span>
                      <span>{f.fromYou + f.fromThem} recs shared</span>
                    </div>
                  </div>
                  <button onClick={() => onViewList(f)} style={{ cursor: 'pointer', background: G.chipBg, border: `1px solid ${G.panelLine}`, borderRadius: 999, padding: '7px 14px', fontFamily: SANS, fontSize: 12, fontWeight: 700, color: C.creamText }}>List</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* sent pending */}
        {pendingFriends.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <SectionTitle>Sent requests</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingFriends.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', background: G.panel, border: `1px solid ${G.panelLine}`, borderRadius: 16, opacity: 0.65 }}>
                  <Avatar name={f.name} hue={f.hue} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: C.creamText }}>{f.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: G.textFaint }}>Pending…</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'absolute', bottom: 110, left: 18, right: 18, zIndex: 80, background: 'rgba(8,48,33,0.96)', border: `1px solid ${G.panelLine}`, borderRadius: 14, padding: '12px 16px', fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: C.creamText, textAlign: 'center', backdropFilter: 'blur(10px)', animation: 'qFade .2s ease' }}>{toast}</div>
      )}
    </div>
  );
}

Object.assign(window, { FriendsScreen });
