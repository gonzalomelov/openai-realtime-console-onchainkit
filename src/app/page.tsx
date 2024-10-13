'use client'

import { Console } from '@/components/console/Console'
import { NotificationManager } from '@/components/NotificationManager'
import '@/styles/App.scss'

export default function Home() {
  return (
    <div data-component="App">
      <NotificationManager />
      <Console />
    </div>
  )
}
