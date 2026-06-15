import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── 类型 ─────────────────────────────────────────────────────────────────────

/** 数据库中的一条消息记录 */
type DbMessage = {
  id: string
  content: string
  reply: string | null
  replied_at: string | null
  created_at: string
  session_id: string
}

/** UI 渲染用的消息 */
type UiMessage = {
  id: string
  role: 'user' | 'support'
  content: string
  created_at: string
  /** 是否是系统 / 欢迎消息（不来自数据库） */
  isSystem?: boolean
}

// ── 工具 ─────────────────────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** 把数据库记录转为 UI 消息列表（用户消息 + 回复各一条） */
function dbToUiMessages(rows: DbMessage[]): UiMessage[] {
  const result: UiMessage[] = []
  for (const row of rows) {
    // 占位符消息（管理员主动发起）：不显示用户气泡，只显示客服回复
    if (row.content !== '__admin_proactive__') {
      result.push({
        id: `user-${row.id}`,
        role: 'user',
        content: row.content,
        created_at: row.created_at,
      })
    }
    if (row.reply) {
      result.push({
        id: `reply-${row.id}`,
        role: 'support',
        content: row.reply,
        created_at: row.replied_at ?? row.created_at,
      })
    }
  }
  return result
}

const WELCOME_MSG: UiMessage = {
  id: 'welcome',
  role: 'support',
  isSystem: true,
  content: '你好！这里是五行能量人工客服。\n\n如有人生重大抉择需要深度个性化指导，或有任何问题与建议，欢迎留言，我们会尽快回复你 🙏',
  created_at: new Date(0).toISOString(),
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function ConsultModal({
  open,
  onClose,
  contextInfo,
}: {
  open: boolean
  onClose: () => void
  contextInfo?: string
}) {
  const [uiMessages, setUiMessages] = useState<UiMessage[]>([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [sessionId] = useState(() => generateId())
  const [newReplyCount, setNewReplyCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // 已展示过的 reply id，用来判断是否有新回复
  const shownReplyIds = useRef<Set<string>>(new Set())

  // 获取当前用户 ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  // ── 拉取该用户的全部历史消息及回复（按 user_id，跨所有 session） ──
  const fetchMessages = useCallback(async () => {
    if (!userId) return   // userId 未加载时不查询
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, content, reply, replied_at, created_at, session_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error || !data) return

    const converted = dbToUiMessages(data as DbMessage[])

    // 统计新出现的回复数量
    let newCount = 0
    for (const msg of converted) {
      if (msg.role === 'support' && !msg.isSystem && !shownReplyIds.current.has(msg.id)) {
        shownReplyIds.current.add(msg.id)
        newCount++
      }
    }
    if (newCount > 0) setNewReplyCount((c) => c + newCount)

    setUiMessages([WELCOME_MSG, ...converted])
  }, [sessionId, userId])

  // 打开时初始化，并每 15 秒轮询一次回复
  useEffect(() => {
    if (!open || !userId) return
    setNewReplyCount(0)
    void fetchMessages()
    const timer = setInterval(() => void fetchMessages(), 15_000)
    setTimeout(() => {
      inputRef.current?.focus()
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => clearInterval(timer)
  }, [open, fetchMessages])

  // 新消息时滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [uiMessages])

  // ── 发送消息 ──
  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    // 乐观 UI：先本地展示
    const tempId = `tmp-${generateId()}`
    const optimisticMsg: UiMessage = {
      id: tempId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setUiMessages((prev) => [...prev, optimisticMsg])

    try {
      await supabase.from('support_messages').insert({
        session_id: sessionId,
        user_id: userId ?? 'anonymous',
        content: text,
        context_info: contextInfo ?? null,
      })
      // 发送成功后拉一次最新数据（替换乐观消息）
      await fetchMessages()
    } catch {
      // 失败时显示错误提示
      setUiMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        {
          id: generateId(),
          role: 'support',
          content: '消息发送失败，请稍后重试。',
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* 背景蒙层 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 对话框 */}
      <div
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-amber-400/20 bg-[#111008] shadow-2xl sm:rounded-3xl"
        style={{ height: 'min(600px, 90dvh)' }}
      >
        {/* 顶部栏 */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/20 text-base">
              🔮
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-100">五行能量客服</div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                在线 · 每 15 秒自动刷新回复
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 手动刷新按钮 */}
            <button
              type="button"
              onClick={() => void fetchMessages()}
              title="刷新回复"
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {newReplyCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black">
                  {newReplyCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 有新回复时的提示条 */}
        {newReplyCount > 0 && (
          <div
            className="flex cursor-pointer items-center justify-center gap-2 bg-amber-500/20 px-4 py-2 text-xs text-amber-200"
            onClick={() => {
              setNewReplyCount(0)
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            客服已回复，点击查看 ↓
          </div>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {uiMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* 头像 */}
              <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm ${
                msg.role === 'support'
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'bg-white/10 text-slate-300'
              }`}>
                {msg.role === 'support' ? '🔮' : '你'}
              </div>

              {/* 气泡 */}
              <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'support'
                    ? 'rounded-tl-sm bg-white/[0.07] text-slate-200'
                    : 'rounded-tr-sm bg-amber-500/25 text-amber-50'
                }`}>
                  {msg.content}
                </div>
                {!msg.isSystem && (
                  <span className="text-[10px] text-slate-600 px-1">{formatTime(msg.created_at)}</span>
                )}
              </div>
            </div>
          ))}

          {/* 发送中指示 */}
          {sending && (
            <div className="flex gap-2.5">
              <div className="h-8 w-8 shrink-0 rounded-full bg-amber-400/20 flex items-center justify-center text-sm text-amber-300">🔮</div>
              <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 输入区 */}
        <div className="border-t border-white/8 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题…（Enter 发送，Shift+Enter 换行）"
              rows={2}
              className="flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/40 focus:outline-none focus:ring-1 focus:ring-amber-400/20 transition-colors"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!input.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/80 text-white shadow transition-all hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 translate-x-px -translate-y-px rotate-45">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-600">消息将发送给客服团队，收到回复后这里会自动更新</p>
        </div>
      </div>
    </div>
  )
}
