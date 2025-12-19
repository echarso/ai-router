import { useState } from 'react'
import ThemeSelector from './ThemeSelector'
import UserWelcome from './UserWelcome'
import './SideNav.css'

function SideNav({ currentView, onViewChange, currentTheme, onThemeChange, lastUpdated, pollInterval, isSystemOwner, isOrganizationAdmin }) {
  const [isOpen, setIsOpen] = useState(false)

  const menuItems = [
    { id: 'home', label: 'Home', icon: '' },
    { id: 'playground', label: 'Playground', icon: '' },
    { id: 'api-keys', label: 'API Keys', icon: '' }
  ]

  if (isOrganizationAdmin) {
    menuItems.push({ id: 'organization', label: 'Organization', icon: '' })
  }

  if (isSystemOwner) {
    menuItems.push({ id: 'organizations', label: 'Organizations', icon: '' })
  }

  const handleItemClick = (viewId) => {
    onViewChange(viewId)
    setIsOpen(false) // Close menu after selection
  }

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      {/* Burger Menu Button - Always visible and clickable */}
      <button 
        className={`burger-menu ${isOpen ? 'open' : ''}`}
        onClick={toggleMenu}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Overlay - Shows when menu is open */}
      <div className={`nav-overlay ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(false)}></div>

      {/* Side Navigation */}
      <nav className={`side-nav ${isOpen ? 'open' : ''}`}>
        <div className="nav-header">
          <h2>Smart Inference Scheduling</h2>
        </div>
        <ul className="nav-menu">
          {menuItems.map(item => (
            <li key={item.id}>
              <button
                className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                onClick={() => handleItemClick(item.id)}
              >
                {item.icon && <span className="nav-icon">{item.icon}</span>}
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="nav-footer">
          {lastUpdated && (
            <div className="nav-status-info">
              <div className="nav-last-updated">
                <span className="nav-status-label">Last updated:</span>
                <span className="nav-status-value">{lastUpdated.toLocaleTimeString()}</span>
              </div>
              <div className="nav-poll-indicator">
                Auto-refreshing every {pollInterval / 1000}s
              </div>
            </div>
          )}
          <div className="nav-user">
            <UserWelcome />
          </div>
          <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} />
        </div>
      </nav>
    </>
  )
}

export default SideNav

