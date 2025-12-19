import './ThemeSelector.css'

function ThemeSelector({ currentTheme, onThemeChange }) {
  const themes = [
    { value: 'bw', label: '⚫ Black & White', name: 'Black & White' },
    { value: 'navy', label: '🔵 Navy Blue', name: 'Navy Blue' },
    { value: 'modern', label: '✨ Modern Professional', name: 'Modern Professional' },
    { value: 'noir', label: '🟡 Noir Yellow', name: 'Noir Yellow' }
  ]

  return (
    <div className="theme-selector">
      <label htmlFor="theme-select" className="theme-label">
        Theme:
      </label>
      <select
        id="theme-select"
        value={currentTheme}
        onChange={(e) => onThemeChange(e.target.value)}
        className="theme-select"
      >
        {themes.map(theme => (
          <option key={theme.value} value={theme.value}>
            {theme.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default ThemeSelector

