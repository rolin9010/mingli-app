import { useEffect, useRef, useCallback } from 'react'

export interface WheelColumn {
  items: string[]
  selectedIndex: number
  onSelect: (index: number) => void
  label?: string
}

interface WheelPickerProps {
  columns: WheelColumn[]
}

const ITEM_HEIGHT = 44
const VISIBLE_COUNT = 5

function WheelColumnItem({ column }: { column: WheelColumn }) {
  const listRef = useRef<HTMLDivElement>(null)
  const isScrolling = useRef(false)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    const el = listRef.current
    if (!el) return
    const targetScrollTop = index * ITEM_HEIGHT
    if (smooth) {
      el.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
    } else {
      el.scrollTop = targetScrollTop
    }
  }, [])

  // 初始化滚动位置
  useEffect(() => {
    scrollToIndex(column.selectedIndex, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 外部 selectedIndex 变化时同步
  useEffect(() => {
    if (!isScrolling.current) {
      scrollToIndex(column.selectedIndex, true)
    }
  }, [column.selectedIndex, scrollToIndex])

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    isScrolling.current = true

    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      isScrolling.current = false
      const rawIndex = el.scrollTop / ITEM_HEIGHT
      const snappedIndex = Math.round(rawIndex)
      const clampedIndex = Math.max(0, Math.min(snappedIndex, column.items.length - 1))
      // snap 到最近格
      el.scrollTo({ top: clampedIndex * ITEM_HEIGHT, behavior: 'smooth' })
      column.onSelect(clampedIndex)
    }, 120)
  }

  const containerHeight = ITEM_HEIGHT * VISIBLE_COUNT

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      {column.label && (
        <div className="text-xs text-amber-400/60 mb-1 tracking-wide">{column.label}</div>
      )}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: containerHeight }}
      >
        {/* 选中项高亮框 */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-10 border-y border-amber-500/50"
          style={{
            top: ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2),
            height: ITEM_HEIGHT,
          }}
        />
        {/* 渐变遮罩 */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              'linear-gradient(to bottom, rgba(15,15,20,0.92) 0%, rgba(15,15,20,0.5) 30%, transparent 45%, transparent 55%, rgba(15,15,20,0.5) 70%, rgba(15,15,20,0.92) 100%)',
          }}
        />
        {/* 滚动列表 */}
        <div
          ref={listRef}
          className="absolute inset-0 overflow-y-scroll scrollbar-hide"
          style={{
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
          onScroll={handleScroll}
        >
          {/* 前置占位 */}
          <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2) }} />
          {column.items.map((item, i) => {
            const distance = Math.abs(i - column.selectedIndex)
            const opacity = distance === 0 ? 1 : distance === 1 ? 0.55 : 0.25
            const scale = distance === 0 ? 1 : distance === 1 ? 0.92 : 0.84
            return (
              <div
                key={i}
                className="flex items-center justify-center cursor-pointer transition-all duration-150 select-none"
                style={{
                  height: ITEM_HEIGHT,
                  scrollSnapAlign: 'center',
                  opacity,
                  transform: `scale(${scale})`,
                  color: distance === 0 ? '#f59e0b' : '#e5e7eb',
                  fontWeight: distance === 0 ? 600 : 400,
                  fontSize: distance === 0 ? '15px' : '13px',
                }}
                onClick={() => {
                  column.onSelect(i)
                  scrollToIndex(i, true)
                }}
              >
                {item}
              </div>
            )
          })}
          {/* 后置占位 */}
          <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2) }} />
        </div>
      </div>
    </div>
  )
}

export default function WheelPicker({ columns }: WheelPickerProps) {
  return (
    <div className="flex gap-1 w-full px-2" style={{ height: ITEM_HEIGHT * VISIBLE_COUNT + 24 }}>
      {columns.map((col, i) => (
        <WheelColumnItem key={i} column={col} />
      ))}
    </div>
  )
}