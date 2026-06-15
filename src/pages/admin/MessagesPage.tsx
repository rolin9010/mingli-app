import { useEffect, useRef, useState } from 'react'
import { adminGetSessions, adminReplyMessage, type AdminSession, type AdminMessage, type AdminSessionUserSnap } from '../../lib/admin'
import UserDetailPanel from './UserDetailPanel'

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date().toISOString().slice(0, 10)
  if (iso.slice(0, 10) === today) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// ── 五行颜色 ──────────────────────────────────────────────────────────────────

const EL_COLOR: Record<string, { bar: string; text: string; bg: string }> = {
  木: { bar: 'bg-emerald-500', text: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  火: { bar: 'bg-rose-500',    text: 'text-rose-300',    bg: 'bg-rose-500/10' },
  土: { bar: 'bg-amber-500',   text: 'text-amber-300',   bg: 'bg-amber-500/10' },
  金: { bar: 'bg-slate-300',   text: 'text-slate-300',   bg: 'bg-slate-300/10' },
  水: { bar: 'bg-blue-400',    text: 'text-blue-300',    bg: 'bg-blue-400/10' },
}

// ── 用户摘要侧边栏 ────────────────────────────────────────────────────────────

function UserSnapPanel({
  snap,
  email,
  userId,
  onViewDetail,
}: {
  snap: AdminSessionUserSnap | null
  email: string
  userId: string
  onViewDetail: () => void
}) {
  return (
    <div className="w-52 shrink-0 flex flex-col gap-3 overflow-y-auto">
      {/* 用户头像 + 跳转 */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onViewDetail}
          title="点击查看用户详情"
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-2xl transition-all hover:bg-amber-400/25 hover:ring-2 hover:ring-amber-400/40"
        >
          👤
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#111] text-[9px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5 text-amber-400">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
        </button>
        <div className="text-center">
          <div className="text-xs font-medium text-slate-200 truncate max-w-[10rem]">{snap?.name ?? '—'}</div>
          <div className="text-[10px] text-slate-500 truncate max-w-[10rem]">{email}</div>
        </div>
        <button
          type="button"
          onClick={onViewDetail}
          className="mt-1 w-full rounded-lg border border-white/10 py-1 text-[10px] text-slate-400 hover:border-amber-400/30 hover:text-amber-200 transition-colors"
        >
          查看详情 →
        </button>
      </div>

      {snap ? (
        <>
          {/* 基础信息 */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-3 space-y-2">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">基础信息</div>
            {snap.birth_date && (
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">生日</span>
                <span className="text-slate-300 font-mono">{snap.birth_date}</span>
              </div>
            )}
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">积分</span>
              <span className="text-amber-300 font-bold">{snap.balance}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">测算次数</span>
              <span className="text-slate-300">{snap.readingCount}</span>
            </div>
          </div>

          {/* 五行能量占比 */}
          {snap.elements && snap.elements.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-3 space-y-2.5">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">五行能量占比</div>
              {snap.elements.map((el) => {
                const c = EL_COLOR[el.element] ?? { bar: 'bg-slate-500', text: 'text-slate-300', bg: '' }
                return (
                  <div key={el.element} className="space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className={`font-semibold ${c.text}`}>{el.element}</span>
                      <span className="text-slate-400 tabular-nums">{el.percent.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${c.bar} transition-all`}
                        style={{ width: `${Math.min(100, el.percent)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {/* 最旺 / 最弱 */}
              {(() => {
                const sorted = [...snap.elements].sort((a, b) => b.percent - a.percent)
                const max = sorted[0]
                const min = sorted[sorted.length - 1]
                return (
                  <div className="flex justify-between pt-1 border-t border-white/[0.06]">
                    <div className="text-center">
                      <div className="text-[9px] text-slate-600">最旺</div>
                      <div className={`text-xs font-bold ${EL_COLOR[max.element]?.text ?? 'text-slate-300'}`}>{max.element}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-slate-600">待补</div>
                      <div className="text-xs font-bold text-violet-300">{min.element}</div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-4 text-center text-[11px] text-slate-600">
          该用户暂无<br/>测算记录
        </div>
      )}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Map<string, string>>(new Map())
  const [replying, setReplying] = useState(false)
  const [replyingMsgId, setReplyingMsgId] = useState<string | null>(null)
  const [readSessions, setReadSessions] = useState<Set<string>>(new Set())
  // 跳转到用户详情
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const data = await adminGetSessions()
    setSessions(data)
    setLoading(false)
    if (!selectedId && data.length > 0) setSelectedId(data[0].session_id)
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedId, sessions])

  const handleSelectSession = (sid: string) => {
    setSelectedId(sid)
    setReadSessions((prev) => new Set([...prev, sid]))
  }

  const selected = sessions.find((s) => s.session_id === selectedId)

  const setDraft = (msgId: string, text: string) => {
    setReplyDrafts((prev) => {
      const next = new Map(prev)
      next.set(msgId, text)
      return next
    })
  }

  const handleReply = async (msg: AdminMessage) => {
    const text = (replyDrafts.get(msg.id) ?? '').trim()
    if (!text || replying) return
    setReplying(true)
    setReplyingMsgId(msg.id)
    const { success } = await adminReplyMessage(msg.id, text)
    if (success) {
      setReplyDrafts((prev) => { const next = new Map(prev); next.delete(msg.id); return next })
      await load()
    }
    setReplying(false)
    setReplyingMsgId(null)
  }

  // 如果在查看用户详情，渲染详情面板
  if (viewingUserId) {
    return (
      <UserDetailPanel
        userId={viewingUserId}
        onBack={() => setViewingUserId(null)}
      />
    )
  }

  if (loading) return <div className="py-20 text-center text-sm text-slate-500">加载中…</div>

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] gap-3 lg:h-[calc(100vh-6rem)]">
      {/* ── 左：会话列表 ── */}
      <div className="w-56 shrink-0 flex flex-col rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <span className="text-sm font-medium text-slate-200">会话列表</span>
          <button type="button" onClick={() => void load()} className="p-1 text-slate-500 hover:text-slate-300">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-600">暂无消息</div>
          ) : (
            sessions.map((s) => {
              const isRead = readSessions.has(s.session_id)
              const showBadge = s.unread_count > 0 && !isRead
              return (
                <button
                  key={s.session_id}
                  type="button"
                  onClick={() => handleSelectSession(s.session_id)}
                  className={`w-full border-b border-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                    selectedId === s.session_id ? 'bg-amber-400/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200 truncate max-w-[110px]">
                      {s.userSnap?.name ? `${s.userSnap.name} · ` : ''}{s.user_email.split('@')[0]}
                    </span>
                    {showBadge && (
                      <span className="ml-1 shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {s.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{s.last_message}</div>
                  <div className="mt-1 text-[10px] text-slate-600">{formatTime(s.last_time)}</div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── 中：聊天详情 ── */}
      <div className="flex flex-1 flex-col rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden min-w-0">
        {selected ? (
          <>
            {/* 标题 */}
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
              {/* 头像可点击 */}
              <button
                type="button"
                onClick={() => selected.user_id && setViewingUserId(selected.user_id)}
                title="点击查看用户详情"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-sm hover:bg-amber-400/25 hover:ring-2 hover:ring-amber-400/30 transition-all"
              >
                👤
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-slate-200 truncate">{selected.user_email}</div>
                  {selected.userSnap?.name && (
                    <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300">
                      {selected.userSnap.name}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">{selected.messages.length} 条消息</div>
              </div>
              {selected.user_id && (
                <button
                  type="button"
                  onClick={() => setViewingUserId(selected.user_id)}
                  className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 hover:border-amber-400/30 hover:text-amber-200 transition-colors"
                >
                  用户详情 →
                </button>
              )}
            </div>

            {/* 消息流 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {selected.messages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  {msg.context_info && (
                    <div className="text-[10px] text-slate-600 text-right">📋 {msg.context_info}</div>
                  )}

                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-amber-500/20 px-4 py-2.5 text-sm text-amber-50 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-600">{formatTime(msg.created_at)}</div>

                  {msg.reply ? (
                    <div className="space-y-1">
                      <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-2.5 text-sm text-slate-200 whitespace-pre-wrap">
                          {msg.reply}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-600">{msg.replied_at ? formatTime(msg.replied_at) : ''} · 已回复</div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2 ml-4">
                      <textarea
                        value={replyDrafts.get(msg.id) ?? ''}
                        onChange={(e) => setDraft(msg.id, e.target.value)}
                        placeholder="输入回复…（Enter 发送，Shift+Enter 换行）"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleReply(msg) }
                        }}
                        className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={replying || !(replyDrafts.get(msg.id) ?? '').trim()}
                        onClick={() => void handleReply(msg)}
                        className="shrink-0 rounded-xl bg-amber-500/70 px-3 py-2 text-xs font-medium text-white hover:bg-amber-400 disabled:opacity-40 transition-colors"
                      >
                        {replying && replyingMsgId === msg.id ? '发送中…' : '回复'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
            选择左侧会话查看详情
          </div>
        )}
      </div>

      {/* ── 右：用户摘要侧边栏 ── */}
      {selected && (
        <UserSnapPanel
          snap={selected.userSnap}
          email={selected.user_email}
          userId={selected.user_id}
          onViewDetail={() => selected.user_id && setViewingUserId(selected.user_id)}
        />
      )}
    </div>
  )
}
