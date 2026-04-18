import './globals.css'

export const metadata = {
  title: 'Book a Slot',
  description: 'Easy online booking with calendar sync',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
