export function PageHeader({ eyebrow = 'Queued', title, subtitle, action }) {
  return (
    <div className="anim-scale flex items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.28em] text-[#B87333]">{eyebrow}</p>
        <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight text-[#F7F1E4]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#D6F0E0]/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({ children, count }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D6F0E0]/50">{children}</p>
      {typeof count === 'number' && <span className="font-mono text-[11px] text-[#D8A84A]">{count}</span>}
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="q-panel-spine rounded-[22px] p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#D8A84A]/30 bg-[#082E20]/80 text-[#D8A84A]">
        <IconSparkles />
      </div>
      <p className="text-sm font-extrabold text-[#F7F1E4]">{title}</p>
      {body && <p className="mt-1 text-sm text-[#D6F0E0]/55">{body}</p>}
      {action}
    </div>
  )
}

export function TypeGlyph({ type, className = '' }) {
  const common = 'currentColor'
  if (type === 'tv') {
    return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2" stroke={common} strokeWidth="2"/><path d="M8 21h8M9 3l3 3 3-3" stroke={common} strokeWidth="2" strokeLinecap="round"/></svg>
  }
  if (type === 'book') {
    return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 4h8a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4V4Z" stroke={common} strokeWidth="2"/><path d="M19 6v14h-8" stroke={common} strokeWidth="2" strokeLinecap="round"/></svg>
  }
  if (type === 'album') {
    return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke={common} strokeWidth="2"/><circle cx="12" cy="12" r="2" stroke={common} strokeWidth="2"/><path d="M16 8h.01" stroke={common} strokeWidth="3" strokeLinecap="round"/></svg>
  }
  return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke={common} strokeWidth="2"/><path d="M8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4" stroke={common} strokeWidth="2" strokeLinecap="round"/></svg>
}

export function StatusDot({ status, className = '' }) {
  const colors = {
    not_yet_viewed: '#D8A84A',
    queued: '#C99A52',
    in_progress: '#C96B4B',
    finished: '#2DD48F',
    skipped: '#7E8C84',
    bailed: '#B5544A',
  }
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} style={{ background: colors[status] ?? '#7E8C84' }} />
}

export function IconBookmark({ className = '' }) {
  return <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
}

export function IconStar({ className = '' }) {
  return <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88L12 3Z"/></svg>
}

function IconSparkles() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
