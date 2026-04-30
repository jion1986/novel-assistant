export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-1/3 rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 rounded-lg bg-muted" />
            <div className="h-40 rounded-lg bg-muted" />
          </div>
          <div className="space-y-4">
            <div className="h-32 rounded-lg bg-muted" />
            <div className="h-32 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
