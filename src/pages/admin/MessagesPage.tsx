import { useEffect, useRef, useState } from 'react'
import { adminGetSessions, adminMarkSessionRead, adminReplyMessage, adminSendProactiveMessage, type AdminSession, type AdminSessionUserSnap } from '../../lib/admin'
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
  onViewDetail,
}: {
  snap: AdminSessionUserSnap | null
  email: string
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

          {/* 四柱八字 */}
          {snap.pillars && snap.pillars.length === 4 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-3 space-y-2">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">四柱八字</div>
              <div className="grid grid-cols-4 gap-1 text-center">
                {['年柱','月柱','日柱','时柱'].map((label, i) => (
                  <div key={label} className="space-y-1">
                    <div className="text-[9px] text-slate-600">{label}</div>
                    <div className="text-[13px] font-bold text-amber-200 font-mono tracking-wider">{snap.pillars![i][0]}</div>
                    <div className="text-[13px] font-bold text-slate-300 font-mono tracking-wider">{snap.pillars![i][1]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
  const [replyDraft, setReplyDraft] = useState('')
  const [replying, setReplying] = useState(false)
  // 当前选中要回复的消息 id（null = 回复最新一条未回复消息）
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  // 本次会话内已标记过已读的 session（避免重复调用接口）
  const [readSessions, setReadSessions] = useState<Set<string>>(new Set())
  // 跳转到用户详情
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // 用 ref 追踪最新的 selectedId，避免 load() 闭包捕获旧值
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  const load = async () => {
    const data = await adminGetSessions()
    setSessions(data)
    setLoading(false)
    // 用 ref 读最新值，避免闭包问题
    if (!selectedIdRef.current && data.length > 0) setSelectedId(data[0].session_id)
  }

  useEffect(() => { void load() }, [])

  // 页面加载完成后，自动标记默认选中的第一个会话为已读
  useEffect(() => {
    if (selectedId && !readSessions.has(selectedId)) {
      setReadSessions((prev) => new Set([...prev, selectedId]))
      void adminMarkSessionRead(selectedId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedId, sessions])

  const handleSelectSession = (sid: string) => {
    setSelectedId(sid)
    // 标记该 session 为已读（写入数据库）
    if (!readSessions.has(sid)) {
      setReadSessions((prev) => new Set([...prev, sid]))
      void adminMarkSessionRead(sid)
    }
  }

  const selected = sessions.find((s) => s.session_id === selectedId)

  // 取当前选中要回复的消息对象
  const getReplyTarget = () => {
    if (!selected) return null
    if (replyTargetId) return selected.messages.find((m) => m.id === replyTargetId) ?? null
    // 默认回复最新一条未回复的消息
    const unreplied = selected.messages.filter((m) => !m.reply && m.content !== '__admin_proactive__')
    return unreplied[unreplied.length - 1] ?? null
  }

  const handleReply = async () => {
    const text = replyDraft.trim()
    if (!text || replying || !selected) return
    setReplying(true)

    const target = getReplyTarget()
    let success = false

    console.log('[handleReply] target:', target, 'user_id:', selected.user_id, 'messages count:', selected.messages.length)

    if (target) {
      // 有未回复的用户消息：给该消息写 reply
      console.log('[handleReply] → adminReplyMessage, msgId:', target.id)
      ;({ success } = await adminReplyMessage(target.id, text))
    } else {
      // 没有未回复的消息（全部已回复，或管理员主动发起）：插入新记录
      const lastMsg = selected.messages[selected.messages.length - 1]
      const sessionId = lastMsg?.session_id ?? selected.session_id
      console.log('[handleReply] → adminSendProactiveMessage, sessionId:', sessionId)
      ;({ success } = await adminSendProactiveMessage(selected.user_id, sessionId, text))
    }
    console.log('[handleReply] success:', success)

    if (success) {
      setReplyDraft('')
      setReplyTargetId(null)
      await load()
    }
    setReplying(false)
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
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-medium text-slate-200 truncate">{selected.user_email}</div>
                  {selected.userSnap?.name && (
                    <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300">
                      {selected.userSnap.name}
                    </span>
                  )}
                  {/* 八字四柱 */}
                  {selected.userSnap?.pillars && (
                    <span className="shrink-0 font-mono text-[11px] text-slate-400 tracking-wider">
                      {selected.userSnap.pillars.join(' ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-slate-500">{selected.messages.length} 条消息</span>
                  {selected.userSnap?.birth_date && (
                    <span className="text-[11px] text-slate-600">生日 {selected.userSnap.birth_date}</span>
                  )}
                </div>
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
              {selected.messages.map((msg, idx) => {
                const prevMsg = selected.messages[idx - 1]
                const isNewSession = idx > 0 && prevMsg.session_id !== msg.session_id
                const isReplyTarget = replyTargetId === msg.id
                return (
                  <div key={msg.id}>
                    {/* 会话分隔线：只显示时间 */}
                    {isNewSession && (
                      <div className="flex items-center gap-2 py-2 mb-2">
                        <div className="flex-1 border-t border-white/[0.07]" />
                        <span className="shrink-0 text-[10px] text-slate-700">{formatTime(msg.created_at)}</span>
                        <div className="flex-1 border-t border-white/[0.07]" />
                      </div>
                    )}

                    {/* context_info */}
                    {msg.context_info && (
                      <div className="text-[10px] text-slate-600 pl-9 mb-1">📋 {msg.context_info}</div>
                    )}

                    {/* 用户消息 → 左侧（占位符消息不展示用户气泡） */}
                    {msg.content !== '__admin_proactive__' && <div className={`flex items-end gap-2 group ${isReplyTarget ? 'ring-1 ring-amber-400/30 rounded-2xl p-1 -m-1' : ''}`}>
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-xs">👤</div>
                      <div className="max-w-[72%]">
                        <div className="rounded-2xl rounded-tl-sm bg-white/[0.08] px-4 py-2.5 text-sm text-slate-100 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 pl-1">
                          <span className="text-[10px] text-slate-600">{formatTime(msg.created_at)}</span>
                          {/* 未回复时显示"回复"按钮 */}
                          {!msg.reply && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTargetId(msg.id)
                                replyInputRef.current?.focus()
                              }}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                                isReplyTarget
                                  ? 'text-amber-300 bg-amber-400/15'
                                  : 'text-slate-600 hover:text-amber-300 opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              回复此条
                            </button>
                          )}
                        </div>
                      </div>
                    </div>}

                    {/* 管理员回复 → 右侧 */}
                    {msg.reply && (
                      <div className="flex items-end justify-end gap-2 mt-2">
                        <div className="max-w-[72%]">
                          <div className="rounded-2xl rounded-tr-sm bg-amber-500/25 px-4 py-2.5 text-sm text-amber-50 whitespace-pre-wrap">
                            {msg.reply}
                          </div>
                          <div className="mt-0.5 text-right text-[10px] text-slate-600 pr-1">
                            {msg.replied_at ? formatTime(msg.replied_at) : ''} · 客服
                          </div>
                        </div>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs">🔮</div>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* 底部固定回复输入框（始终显示） */}
            {(() => {
              const target = getReplyTarget()
              const hasUnreplied = selected.messages.some((m) => !m.reply && m.content !== '__admin_proactive__')
              return (
                <div className="border-t border-white/[0.07] px-5 py-3 space-y-2">
                  {/* 回复目标提示 */}
                  {replyTargetId && target && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>↩ 回复：<span className="text-amber-300/80 truncate max-w-[20rem] inline-block align-bottom">{target.content}</span></span>
                      <button type="button" onClick={() => setReplyTargetId(null)} className="ml-2 text-slate-600 hover:text-slate-400">✕ 取消</button>
                    </div>
                  )}
                  {/* 无待回复消息时的提示（不阻止发送） */}
                  {!hasUnreplied && !replyTargetId && (
                    <div className="text-[10px] text-slate-600">所有消息已回复 · 可继续发送新消息</div>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={replyInputRef}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder={target ? `回复：${target.content.slice(0, 20)}${target.content.length > 20 ? '…' : ''}` : '发送消息给用户…'}
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleReply() }
                      }}
                      className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={replying || !replyDraft.trim()}
                      onClick={() => void handleReply()}
                      className="shrink-0 rounded-xl bg-amber-500/70 px-4 py-2 text-xs font-medium text-white hover:bg-amber-400 disabled:opacity-40 transition-colors"
                    >
                      {replying ? '发送中…' : '发送'}
                    </button>
                  </div>
                </div>
              )
            })()}
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
          onViewDetail={() => selected.user_id && setViewingUserId(selected.user_id)}
        />
      )}
    </div>
  )
}
