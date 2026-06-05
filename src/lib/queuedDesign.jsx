/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'

export const C = {
  cream: '#F4E9D1',
  creamText: '#F7F1E4',
  brass: '#B87333',
  gold: '#D8A84A',
  terra: '#C96B4B',
  mint: '#2DD48F',
  ink: '#052016',
}

export const G = {
  hero: 'radial-gradient(120% 130% at 0% 0%, rgba(45,212,143,0.16), transparent 46%), linear-gradient(158deg, #11543C 0%, #0C3F2C 58%, #082A1D 100%)',
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
  textDim: 'rgba(214,240,224,0.70)',
  textFaint: 'rgba(214,240,224,0.50)',
}

export const MEDIA = {
  movie: { key: 'movie', label: 'Movies', singular: 'movies', cover: ['#33271a', '#1c130b'] },
  tv: { key: 'tv', label: 'TV', singular: 'tv', cover: ['#2a3b2f', '#16241b'] },
  book: { key: 'book', label: 'Books', singular: 'books', cover: ['#3a2a1c', '#211610'] },
  album: { key: 'album', label: 'Albums', singular: 'albums', cover: ['#3a2330', '#1e131b'] },
}

export const MEDIA_ORDER = ['movie', 'tv', 'book', 'album']

export const STATUS = {
  not_yet_viewed: { label: 'New', short: 'New', dot: '#D8A84A' },
  queued: { label: 'Queued', short: 'Queued', dot: '#C99A52' },
  in_progress: { label: 'In progress', short: 'Now', dot: '#C96B4B' },
  finished: { label: 'Finished', short: 'Done', dot: '#2DD48F' },
  skipped: { label: 'Skipped', short: 'Skip', dot: '#7E8C84' },
  bailed: { label: 'Bailed', short: 'Bail', dot: '#B5544A' },
}

export const STATUS_ORDER = ['not_yet_viewed', 'queued', 'in_progress', 'finished', 'skipped', 'bailed']
export const ACTIVE_STATUSES = ['not_yet_viewed', 'queued', 'in_progress']

export function titleInitials(title) {
  const words = String(title || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean)
  if (!words.length) return '?'
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : `${words[0][0]}${words[1][0]}`.toUpperCase()
}

export function MediaGlyph({ type, size = 15, color = C.cream }) {
  const common = { width: size, height: size, display: 'block' }
  if (type === 'movie') return <svg viewBox="0 0 16 16" style={common} fill="none"><rect x="1.5" y="3" width="13" height="10" rx="1.6" stroke={color} strokeWidth="1.4"/><path d="M7 6.2l3 1.8-3 1.8z" fill={color}/></svg>
  if (type === 'tv') return <svg viewBox="0 0 16 16" style={common} fill="none"><rect x="1.5" y="3.5" width="13" height="8.5" rx="1.6" stroke={color} strokeWidth="1.4"/><path d="M6 13.5h4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></svg>
  if (type === 'book') return <svg viewBox="0 0 16 16" style={common} fill="none"><rect x="3" y="2" width="10" height="12" rx="1.2" stroke={color} strokeWidth="1.4"/><path d="M5.6 2v12" stroke={color} strokeWidth="1.3"/></svg>
  return <svg viewBox="0 0 16 16" style={common} fill="none"><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.4"/><circle cx="8" cy="8" r="1.5" fill={color}/></svg>
}

export function PosterTile({ item, className = '', w, h, radius = 10, children }) {
  const type = item?.media_type || item?.type || 'movie'
  const media = MEDIA[type] || MEDIA.movie
  const style = {
    width: w,
    height: h,
    borderRadius: radius,
    background: `linear-gradient(155deg, ${media.cover[0]}, ${media.cover[1]})`,
  }
  if (item?.media_poster_url) {
    return (
      <div className={`relative shrink-0 overflow-hidden shadow-lg ${className}`} style={{ width: w, height: h, borderRadius: radius }}>
        <img src={item.media_poster_url} alt={item.media_title || ''} className="h-full w-full object-cover" />
        {children}
      </div>
    )
  }
  return (
    <div className={`relative shrink-0 overflow-hidden border border-white/10 shadow-lg ${className}`} style={style}>
      <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(125deg, rgba(244,233,209,0.05) 0 2px, transparent 2px 9px)' }} />
      <div className="font-mono-q absolute inset-0 flex items-center justify-center text-[13px] font-semibold tracking-[1px] text-[#F4E9D1]/80">
        {titleInitials(item?.media_title || item?.title)}
      </div>
      <div className="absolute bottom-1.5 left-1.5 opacity-80"><MediaGlyph type={type} size={11} color="rgba(244,233,209,0.9)" /></div>
      {children}
    </div>
  )
}

export function ScreenHeader({ title, subtitle, eyebrow = 'Queued', right, back }) {
  return (
    <header className="flex items-end justify-between gap-3 px-[18px] pb-3 pt-[52px]">
      <div className="flex min-w-0 items-end gap-3">
        {back}
        <div className="min-w-0">
          <p className="font-mono-q text-[10.5px] font-semibold uppercase tracking-[3px] text-[#B87333]">{eyebrow}</p>
          <h1 className="mt-0.5 truncate text-[28px] font-extrabold leading-[1.08] text-[#F7F1E4]">{title}</h1>
          {subtitle && <p className="mt-1 text-[12.5px] font-semibold text-[rgba(214,240,224,0.5)]">{subtitle}</p>}
        </div>
      </div>
      {right}
    </header>
  )
}

export function SectionTitle({ children, count }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="font-mono-q text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[rgba(214,240,224,0.5)]">{children}</span>
      {count != null && <span className="font-mono-q text-[10.5px] text-[#D8A84A]">{count}</span>}
      <span className="h-px flex-1 bg-[rgba(150,214,180,0.12)]" />
    </div>
  )
}

export function SearchField({ value, onChange, placeholder, autoFocus = false }) {
  return (
    <div className="relative">
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke={C.cream} strokeWidth="2"/><path d="m21 21-4.35-4.35" stroke={C.cream} strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <input autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-[14px] border-[1.5px] border-[rgba(150,214,180,0.16)] bg-[rgba(2,17,12,0.7)] py-3 pl-10 pr-3.5 text-sm text-[#F7F1E4] outline-none placeholder:text-[#F7F1E4]/35 focus:border-[#D8A84A]/80" />
    </div>
  )
}

export function Chip({ active, children, onClick, disabled = false }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`btn-press shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-all disabled:pointer-events-none disabled:opacity-35 ${active ? 'border-[#D8A84A] bg-[#F4E9D1] text-[#052016]' : 'border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.66)] text-[rgba(214,240,224,0.7)]'}`}>
      {children}
    </button>
  )
}

export function MediumTabs({ value, onChange, counts = {}, showCounts = true }) {
  return (
    <div className="mx-[18px] flex gap-1 rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(8,46,32,0.72)] p-[3px]">
      {MEDIA_ORDER.map(type => {
        const active = value === type
        return (
          <button key={type} type="button" onClick={() => onChange(type)}
            className={`btn-press flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[14px] border px-1 py-2 transition-all ${active ? 'border-[#D8A84A] bg-[#F4E9D1] text-[#052016]' : 'border-transparent text-[#F4E9D1]'}`}>
            <MediaGlyph type={type} color={active ? C.ink : C.cream} />
            <span className="text-[11px] font-bold leading-none">{MEDIA[type].label}</span>
            {showCounts && <span className={`font-mono-q text-[9.5px] font-semibold leading-none ${active ? 'text-[#052016]/60' : 'text-[rgba(214,240,224,0.5)]'}`}>{counts[type] ?? 0}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function StatusMenu({ value, onChange, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const status = STATUS[value] || STATUS.queued
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="font-mono-q btn-press inline-flex items-center gap-1.5 rounded-full border border-[rgba(150,214,180,0.16)] bg-[rgba(2,17,12,0.55)] px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.3px] text-[#F7F1E4]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
        {status.short}
        <svg width="8" height="6" viewBox="0 0 8 6" className="opacity-60"><path d="M1 1l3 3 3-3" stroke={C.cream} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute top-[calc(100%+6px)] z-50 min-w-[150px] rounded-[14px] border border-[#F4E9D1]/25 bg-[rgba(6,30,21,0.98)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur ${align === 'left' ? 'left-0' : 'right-0'}`}>
            {STATUS_ORDER.map(key => (
              <button key={key} type="button" onClick={() => { onChange(key); setOpen(false) }}
                className={`flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-semibold text-[#F7F1E4] ${key === value ? 'bg-[#F4E9D1]/10' : ''}`}>
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS[key].dot }} />
                {STATUS[key].label}
                {key === value && <span className="ml-auto text-[#D8A84A]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-[18px] px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex h-[46px] w-[46px] items-center justify-center rounded-[14px] border border-[rgba(150,214,180,0.16)] bg-[#2DD48F]/10">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h9" stroke={C.mint} strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
      <p className="text-[14.5px] font-bold text-[#F7F1E4]">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-[250px] text-[12.5px] text-[rgba(214,240,224,0.5)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SheetShell({ children, onClose, title, footer, size = 'default' }) {
  const sizeClass = size === 'peek'
    ? 'max-h-[60dvh] overflow-y-auto'
    : ''
  return (
    <>
      <div className="fixed inset-0 z-30 bg-[rgba(2,10,7,0.55)] backdrop-blur-[2px]" style={{ animation: 'qFade .2s ease' }} onClick={onClose} />
      <div className="fixed inset-0 z-40 flex items-end justify-center pointer-events-none">
        <div className={`pointer-events-auto w-full max-w-[430px] rounded-t-[26px] border-t border-[#F4E9D1]/25 bg-[linear-gradient(180deg,#0a3526,#062318)] px-[18px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_60px_rgba(0,0,0,0.5)] ${sizeClass}`} style={{ animation: 'qUp .28s cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="mx-auto mb-3.5 h-1 w-[38px] rounded-full bg-[#F4E9D1]/25" />
          {title && (
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="text-[17px] font-extrabold text-[#F7F1E4]">{title}</h2>
              <button onClick={onClose} className="btn-press p-1 text-xl leading-none text-[rgba(214,240,224,0.5)]">×</button>
            </div>
          )}
          {children}
          {footer && <div className="mt-4">{footer}</div>}
        </div>
      </div>
    </>
  )
}
