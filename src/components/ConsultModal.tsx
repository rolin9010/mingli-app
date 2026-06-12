import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── 类型 ─────────────────────────────────────────────────────────────────────

type Message = {
  id: string
  role: 'user' | 'support'
  content: string
  created_at: string
}

// ── 工具 ─────────────────────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function ConsultModal({
  open,
  onClose,
  contextInfo,
}: {
  open: boolean
  onClose: () => void
  /** 可选：当前报告的上下文信息（如姓名），自动附加到第一条消息 */
  contextInfo?: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [sessionId] = useState(() => generateId())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 获取当前用户 ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  // 打开时加载历史消息（同一 session）
  useEffect(() => {
    if (!open) return
    const welcome: Message = {
      id: 'welcome',
      role: 'support',
      content:
        '你好！这里是五行能量人工客服。\n\n如有人生重大抉择需要深度个性化指导，或有任何问题与建议，欢迎留言，我们会尽快回复你。',
      created_at: new Date().toISOString(),
    }
    setMessages([welcome])
    setTimeout(() => {
      inputRef.current?.focus()
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [open])

  // 新消息时滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      // 写入 Supabase support_messages 表
      await supabase.from('support_messages').insert({
        session_id: sessionId,
        user_id: userId ?? 'anonymous',
        content: text,
        context_info: contextInfo ?? null,
        created_at: new Date().toISOString(),
      })

      // 自动回复
      const autoReply: Message = {
        id: generateId(),
        role: 'support',
        content:
          '已收到你的消息，我们会尽快安排老师为你提供个性化深度指导，请耐心等候 🙏',
        created_at: new Date().toISOString(),
      }
      setTimeout(() => {
        setMessages((prev) => [...prev, autoReply])
        setSending(false)
      }, 800)
    } catch {
      setSending(false)
      const errMsg: Message = {
        id: generateId(),
        role: 'support',
        content: '消息发送失败，请稍后重试。',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
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
    // 遮罩
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* 背景蒙层 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 对话框 */}
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-amber-400/20 bg-[#111008] shadow-2xl sm:rounded-3xl"
        style={{ height: 'min(600px, 90dvh)' }}
      >
        {/* 顶部栏 */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-3">
            {/* 客服头像 */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/20 text-base">
              🔮
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-100">五行能量客服</div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                在线
              </div>
            </div>
          </div>
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

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {messages.map((msg) => (
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
              <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'support'
                    ? 'rounded-tl-sm bg-white/[0.07] text-slate-200'
                    : 'rounded-tr-sm bg-amber-500/25 text-amber-50'
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-600 px-1">{formatTime(msg.created_at)}</span>
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
          <p className="mt-2 text-center text-[10px] text-slate-600">消息将发送给我们的客服团队，我们会尽快回复</p>
        </div>
      </div>
    </div>
  )
}
