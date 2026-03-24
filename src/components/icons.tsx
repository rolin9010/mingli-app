import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function IconSparkle(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2l1.5 6L20 10l-6.5 2L12 22l-1.5-10L4 10l6.5-2L12 2z" />
    </IconBase>
  )
}

export function IconSun(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </IconBase>
  )
}

export function IconBloodDrop(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z" />
      <path d="M9.5 14a2.5 2.5 0 0 0 5 0" />
    </IconBase>
  )
}

export function IconMind(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M9 3a4 4 0 0 0-1 7.5V14a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3v-3.5A4 4 0 0 0 15 3" />
      <path d="M10 7h4" />
    </IconBase>
  )
}

export function IconMoonStars(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 12.4A8.5 8.5 0 1 1 11.6 3a6.5 6.5 0 0 0 9.4 9.4z" />
      <path d="M6 3l.5 1.5L8 5l-1.5.5L6 7l-.5-1.5L4 5l1.5-.5L6 3z" />
    </IconBase>
  )
}

export function IconCards(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 7h12v14H7z" />
      <path d="M17 7V5a2 2 0 0 0-2-2H5v14a2 2 0 0 0 2 2h2" />
    </IconBase>
  )
}

/** 罗盘 / 精准排盘 */
export function IconCompass(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12l4.5-2.5" />
      <path d="M12 12l-4.5 2.5" />
      <path d="M12 7l1 5-1 5-1-5 1-5z" />
    </IconBase>
  )
}

/** 展开书卷 / AI 解读 */
export function IconBookOpen(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5.5v14" />
      <path d="M4.5 6.5a2.5 2.5 0 0 1 2.5-2h3.5v13H7a2.5 2.5 0 0 1-2.5-2.5V6.5z" />
      <path d="M19.5 6.5a2.5 2.5 0 0 0-2.5-2h-3.5v13H17a2.5 2.5 0 0 0 2.5-2.5V6.5z" />
    </IconBase>
  )
}

/** 人物 / 名师咨询 */
export function IconUserBust(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-.5a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v.5" />
    </IconBase>
  )
}

