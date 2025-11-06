"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts"

interface DailyStats {
  date: string
  dayName: string
  videos: number
  images: number
  total: number
}

// Support both old and new API shapes
interface LegacyStatsData {
  totalReels: number
  totalImages: number
  dailyStats: DailyStats[]
}

interface WeeklyStatItem {
  date: string
  dayName: string
  reels: number
  posts: number
  total: number
}

interface NewStatsData {
  weeklyTotals: { reels: number; posts: number }
  weeklyStats: WeeklyStatItem[]
}

type StatsData = LegacyStatsData | NewStatsData

export function AdminStats() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("/api/admin/stats")
        if (!response.ok) throw new Error("Failed to fetch stats")
        const data = await response.json()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats")
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (isLoading) {
    return <p className="text-gray-600">Loading stats...</p>
  }

  if (error || !stats) {
    return <p className="text-red-600">{error || "Failed to load stats"}</p>
  }
  // Build week data (Mon-Sun) once so it's easier to debug and reuse
  const buildWeekData = () => {
    const map: Record<string, { videos: number; images: number; dayName: string }> = {}
    // Support either new API shape (weeklyStats) or legacy (dailyStats)
    const sourceArray: any[] = (stats as any).weeklyStats ?? (stats as any).dailyStats ?? []
    sourceArray.forEach((d: any) => {
      const localKey = new Date(d.date).toLocaleDateString("en-CA") // YYYY-MM-DD local
      const videos = d.reels ?? d.videos ?? 0
      const images = d.posts ?? d.images ?? 0
      const dayName = d.dayName ?? new Date(d.date).toLocaleDateString("en-US", { weekday: "long" })
      map[localKey] = { videos, images, dayName }
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jsDay = today.getDay()
    const daysSinceMonday = (jsDay + 6) % 7
    const monday = new Date(today)
    monday.setDate(today.getDate() - daysSinceMonday)

    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    const week: any[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStrLocal = d.toLocaleDateString("en-CA")
      const entry = map[dateStrLocal]
      week.push({
        date: dateStrLocal,
        dayName: dayNames[i],
        videos: entry ? entry.videos : 0,
        images: entry ? entry.images : 0,
        total: (entry ? entry.videos : 0) + (entry ? entry.images : 0),
      })
    }
    return week
  }

  const weekData = buildWeekData()
  // debug: ensure data looks correct in console
  console.debug("AdminStats weekData:", weekData)

  // Derive totals in a unified shape (support new and legacy API responses)
  const totals = 'weeklyTotals' in stats
    ? (stats as NewStatsData).weeklyTotals
    : { reels: (stats as LegacyStatsData).totalReels ?? 0, posts: (stats as LegacyStatsData).totalImages ?? 0 }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Reels</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-blue-600">{totals.reels}</p>
            <p className="text-xs text-gray-500 mt-1">Videos uploaded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Images</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-purple-600">{totals.posts}</p>
            <p className="text-xs text-gray-500 mt-1">Images uploaded</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Content Flow</CardTitle>
          <CardDescription>Daily uploads for the current week (Monday → Sunday)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {/* Build a week view (Mon-Sun) and highlight today. Use stats.dailyStats as source. */}
            <BarChart data={weekData} barGap={8} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dayName" stroke="#6b7280" />
              <YAxis stroke="#6b7280" allowDecimals={false} domain={[0, 15]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: any, name: any) => [value, name]}
                cursor={{ fill: 'rgba(99,102,241,0.06)' }}
              />
              <Legend />
              {/* Use Cells to color today's bars differently */}
              <Bar dataKey="videos" name="Reels" radius={[8, 8, 0, 0]} fill="#3b82f6" stroke="#1e40af" barSize={18} minPointSize={2}>
                {(() => {
                  const today = new Date(); today.setHours(0,0,0,0)
                  const jsDay = today.getDay()
                  const daysSinceMonday = (jsDay + 6) % 7
                  const monday = new Date(today); monday.setDate(today.getDate() - daysSinceMonday)
                  const colors: string[] = []
                  for (let i = 0; i < 7; i++) {
                    const d = new Date(monday); d.setDate(monday.getDate() + i)
                    const dateStrLocal = d.toLocaleDateString('en-CA')
                    const isToday = dateStrLocal === today.toLocaleDateString('en-CA')
                    colors.push(isToday ? '#1e40af' : '#3b82f6')
                  }
                  return colors.map((c, idx) => <Cell key={idx} fill={c} />)
                })()}
                <LabelList dataKey="videos" position="top" formatter={(value: any) => (value > 0 ? value : "") } />
              </Bar>
              <Bar dataKey="images" name="Images" radius={[8, 8, 0, 0]} fill="#a855f7" stroke="#6b21a8" barSize={18} minPointSize={2}>
                {(() => {
                  const today = new Date(); today.setHours(0,0,0,0)
                  const jsDay = today.getDay()
                  const daysSinceMonday = (jsDay + 6) % 7
                  const monday = new Date(today); monday.setDate(today.getDate() - daysSinceMonday)
                  const colors: string[] = []
                  for (let i = 0; i < 7; i++) {
                    const d = new Date(monday); d.setDate(monday.getDate() + i)
                    const dateStrLocal = d.toLocaleDateString('en-CA')
                    const isToday = dateStrLocal === today.toLocaleDateString('en-CA')
                    colors.push(isToday ? '#6b21a8' : '#a855f7')
                  }
                  return colors.map((c, idx) => <Cell key={idx} fill={c} />)
                })()}
                <LabelList dataKey="images" position="top" formatter={(value: any) => (value > 0 ? value : "") } />
              </Bar>
              {/* Add a transparent Bar with LabelList to show daily total on top */}
              <Bar dataKey="total" name="Total" fill="transparent" stroke="transparent" barSize={0}>
                <LabelList dataKey="total" position="top" formatter={(value: any) => (value > 0 ? value : "")} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Content Pieces:</span>
              <span className="font-semibold text-gray-900">{totals.reels + totals.posts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Reels Percentage:</span>
              <span className="font-semibold text-blue-600">
                {totals.reels + totals.posts > 0
                  ? ((totals.reels / (totals.reels + totals.posts)) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Images Percentage:</span>
              <span className="font-semibold text-purple-600">
                {totals.reels + totals.posts > 0
                  ? ((totals.posts / (totals.reels + totals.posts)) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
