function Layout({ children, tabs, activeTab, onTabChange }) {
  const openInTab = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html')
    })
    window.close()
  }

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
              F
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Factorial Clock</h1>
              <p className="text-xs text-gray-500">Weekly Schedule Manager</p>
            </div>
          </div>
          <button
            onClick={openInTab}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="Open in new tab"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-visible p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3">
        <p className="text-xs text-gray-500 text-center">
          v0.1.4 · Made for Factorial HR
        </p>
      </footer>
    </div>
  )
}

export default Layout
