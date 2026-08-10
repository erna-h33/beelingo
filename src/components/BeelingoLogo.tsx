import type { SVGProps } from "react"

/**
 * Beelingo's mark: a woven beehive (skep) silhouette, drawn in the same
 * 24x24 viewBox / 2px round-stroke convention as the lucide-react icons
 * it sits next to everywhere it's used -- so it's a drop-in replacement
 * for those icons (size-N + text-* utilities both keep working via
 * currentColor) rather than a one-off asset that needs its own sizing
 * rules.
 */
export function BeelingoLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 20C4 14 6 4 12 4C18 4 20 14 20 20Z" />
      <path d="M6.5 9C8 10.5 16 10.5 17.5 9" />
      <path d="M4.8 15C7 17 17 17 19.2 15" />
      <ellipse cx="12" cy="18.3" rx="1.3" ry="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
