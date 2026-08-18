import { cn } from '@/lib/utils'

type AiFaceIconProps = {
  className?: string
  blinking?: boolean
}

/** Mặt robot AI — mắt chớp + viền nhấp nháy. */
export function AiFaceIcon({ className, blinking = true }: AiFaceIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn(blinking && 'ai-face-icon--live', className)}
    >
      <rect x="4.5" y="6" width="15" height="13.5" rx="5" fill="currentColor" opacity="0.15" />
      <rect x="4.5" y="6" width="15" height="13.5" rx="5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 6V3.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="2.8" r="1.15" fill="currentColor" />
      <g className="ai-face-eye">
        <circle cx="9.2" cy="12.1" r="1.35" fill="currentColor" />
      </g>
      <g className="ai-face-eye ai-face-eye--right">
        <circle cx="14.8" cy="12.1" r="1.35" fill="currentColor" />
      </g>
      <path
        d="M9.4 15.35c.7.85 1.55 1.25 2.6 1.25s1.9-.4 2.6-1.25"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
  )
}
