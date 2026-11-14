function Placeholder({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />
}

export function WorkspaceLoadingSkeleton() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading workspace page</span>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <Placeholder className="h-8 w-48" />
          <Placeholder className="h-4 w-72 max-w-[70vw]" />
        </div>
        <Placeholder className="h-10 w-32" />
      </div>
      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <Placeholder className="h-10 w-56 max-w-full" />
        <Placeholder className="h-10 w-36" />
        <Placeholder className="h-10 w-28" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex gap-6 border-b bg-muted/30 p-4">
          <Placeholder className="h-4 w-28" />
          <Placeholder className="h-4 w-24" />
          <Placeholder className="h-4 w-20" />
        </div>
        <div className="space-y-5 p-5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-6">
              <Placeholder className="h-4 flex-1" />
              <Placeholder className="h-4 w-28" />
              <Placeholder className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
