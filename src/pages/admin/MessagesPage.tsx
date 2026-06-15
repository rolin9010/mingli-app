import { useEffect, useRef, useState } from 'react'
import { adminGetSessions, adminReplyMessage, type AdminSession, type AdminMessage } from '../../lib/admin'

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date().toISOString().slice(0, 10)
  if (iso.slice(0, 10) === today) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function MessagesPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 用 Map<msgId, text> 分别存每条消息的回复草稿，避免多条消息共享一个 state
  const [replyDrafts, setReplyDrafts] = useState<Map<string, string>>(new Map())
  const [replying, setReplying] = useState(false)
  const [replyingMsgId, setReplyingMsgId] = useState<string | null>(null)
  // 本地已读 set，点击会话后标记为已读（视觉上消除红点）
  const [readSessions, setReadSessions] = useState<Set<string>>(new Set())
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
    // 点击即标记已读
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
      // 清空这条消息的草稿
      setReplyDrafts((prev) => { const next = new Map(prev); next.delete(msg.id); return next })
      await load()
    }
    setReplying(false)
    setReplyingMsgId(null)
  }

  if (loading) return <div className="py-20 text-center text-sm text-slate-500">加载中…</div>

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] gap-4 lg:h-[calc(100vh-6rem)]">
      {/* ── 左：会话列表 ── */}
      <div className="w-64 shrink-0 flex flex-col rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
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
                    <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                      {s.user_email}
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

      {/* ── 右：聊天详情 ── */}
      <div className="flex flex-1 flex-col rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden min-w-0">
        {selected ? (
          <>
            {/* 标题 */}
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-sm">👤</div>
              <div>
                <div className="text-sm font-medium text-slate-200">{selected.user_email}</div>
                <div className="text-[11px] text-slate-500">{selected.messages.length} 条消息</div>
              </div>
            </div>

            {/* 消息流 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {selected.messages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  {/* context_info 标签 */}
                  {msg.context_info && (
                    <div className="text-[10px] text-slate-600 text-right">📋 {msg.context_info}</div>
                  )}

                  {/* 用户消息 */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-amber-500/20 px-4 py-2.5 text-sm text-amber-50 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-600">{formatTime(msg.created_at)}</div>

                  {/* 已回复 */}
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
                    /* 未回复：内联回复框 */
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
    </div>
  )
}
