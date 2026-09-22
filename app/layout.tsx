import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "MediTrack",
  description: "Medication tracking and ESP32 dose monitoring",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
