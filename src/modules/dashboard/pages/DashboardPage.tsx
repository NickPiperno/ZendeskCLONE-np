export function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <h3 className="font-semibold">Total Tickets</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <h3 className="font-semibold">Open Tickets</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <h3 className="font-semibold">Response Time</h3>
          <p className="text-2xl font-bold">0m</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <h3 className="font-semibold">Resolution Rate</h3>
          <p className="text-2xl font-bold">0%</p>
        </div>
      </div>
    </div>
  )
} 