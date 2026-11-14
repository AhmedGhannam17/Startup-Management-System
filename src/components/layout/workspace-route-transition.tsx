'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { WorkspaceLoadingSkeleton } from '@/components/layout/workspace-loading-skeleton'

export function WorkspaceRouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    setIsNavigating(false)
  }, [pathname])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest('a[href]')
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      )
        return
      const destination = new URL(link.href, window.location.href)
      if (
        destination.origin !== window.location.origin ||
        destination.pathname === window.location.pathname
      )
        return
      setIsNavigating(true)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return (
    <div className="relative min-h-[calc(100vh-9rem)]">
      <div className={isNavigating ? 'invisible' : undefined} aria-hidden={isNavigating}>
        {children}
      </div>
      {isNavigating && (
        <div
          className="absolute inset-0"
          role="status"
          aria-live="polite"
          aria-label="Loading page"
        >
          <WorkspaceLoadingSkeleton />
        </div>
      )}
    </div>
  )
}
