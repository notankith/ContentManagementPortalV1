import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Editors Portal - Content Management",
  description: "Professional content management portal for video editors and graphic designers",
  generator: "v0.app",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
        <footer className="w-full border-t border-gray-200 bg-white/50 py-4">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-600">
            <a href="/ankith" target="_blank" className="underline text-gray-700 hover:text-gray-900" rel="noopener noreferrer">
              Built by Ankith Studio
            </a>
          </div>
        </footer>
      </body>
    </html>
  )
}
