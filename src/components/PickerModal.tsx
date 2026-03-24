import { useEffect, useRef } from 'react'

interface PickerModalProps {
  open: boolean
  title: string
  onClose: () => void
  onConfirm: () => void
  children: React.ReactNode
}

export default function PickerModal({
  open,
  title,
  onClose,
  onConfirm,
  children,
}: PickerModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // 禁止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onMouseDown={(e) => {
        // 点击遮罩关闭
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-lg mx-auto rounded-t-2xl border border-white/10 shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1a 100%)',
          animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 顶部把手 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <button
            className="text-sm text-gray-400 hover:text-white transition-colors px-1 py-1"
            onClick={onClose}
          >
            取消
          </button>
          <span className="text-sm font-semibold text-amber-300 tracking-wide">{title}</span>
          <button
            className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors px-1 py-1"
            onClick={onConfirm}
          >
            确定
          </button>
        </div>

        {/* 内容区 */}
        <div className="px-2 py-3">{children}</div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}