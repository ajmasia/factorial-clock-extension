import { useState } from 'react'
import Layout from './components/Layout'
import ConfigPage from './pages/ConfigPage'
import GeneratePage from './pages/GeneratePage'
import HistoryPage from './pages/HistoryPage'
import ExceptionsPage from './pages/ExceptionsPage'

const TABS = [
  { id: 'generate', label: 'Generate', icon: '📅' },
  { id: 'config', label: 'Config', icon: '⚙️' },
  { id: 'history', label: 'History', icon: '📊' },
  { id: 'exceptions', label: 'Exceptions', icon: '🚫' },
]

function App() {
  const [activeTab, setActiveTab] = useState('generate')

  const renderPage = () => {
    switch (activeTab) {
      case 'config':
        return <ConfigPage />
      case 'generate':
        return <GeneratePage />
      case 'history':
        return <HistoryPage />
      case 'exceptions':
        return <ExceptionsPage />
      default:
        return <GeneratePage />
    }
  }

  return (
    <Layout tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      {renderPage()}
    </Layout>
  )
}

export default App
