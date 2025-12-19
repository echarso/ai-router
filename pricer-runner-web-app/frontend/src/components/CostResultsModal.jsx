import { useEffect, useState } from 'react'
import './CostResultsModal.css'

function CostResultsModal({ results, prompt, formatPrice, onClose, inline = false, hideAllModelsTable = false }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [showChart, setShowChart] = useState(true)
  const [showAllComparedModels, setShowAllComparedModels] = useState(false)

  // Close modal on ESC key press (only for modal mode)
  useEffect(() => {
    if (inline) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, inline])

  // Prevent body scroll when modal is open (only for modal mode)
  useEffect(() => {
    if (inline) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [inline])

  if (!results || (!results.allModels && !results.selectedModels)) {
    return null
  }

  const allModels = results.allModels
  const selectedModels = results.selectedModels
  const comparedModels = Array.isArray(results.comparedModels) ? results.comparedModels : []
  const estimatedTokens = allModels?.results[0]?.estimated_tokens || selectedModels?.results[0]?.estimated_tokens || 0

  // Prepare data for bar chart
  const getChartData = () => {
    const chartData = []
    
    // Add selected models if any
    if (selectedModels && selectedModels.results.length > 0) {
      selectedModels.results.forEach(model => {
        chartData.push({
          label: `${model.model_name} (${model.provider})`,
          value: model.total_cost,
          type: 'selected',
          model: model
        })
      })
    }
    
    // Add cheapest and most expensive from all models
    if (allModels) {
      chartData.push({
        label: `Cheapest: ${allModels.cheapest.model_name} (${allModels.cheapest.provider})`,
        value: allModels.cheapest.total_cost,
        type: 'cheapest',
        model: allModels.cheapest
      })
      chartData.push({
        label: `Most Expensive: ${allModels.mostExpensive.model_name} (${allModels.mostExpensive.provider})`,
        value: allModels.mostExpensive.total_cost,
        type: 'mostExpensive',
        model: allModels.mostExpensive
      })
    }
    
    // Sort by value for better visualization
    return chartData.sort((a, b) => a.value - b.value)
  }

  const chartData = getChartData()
  const maxValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 1

  const content = (
    <div className={inline ? "cost-results-inline" : "modal-content"} onClick={inline ? undefined : (e) => e.stopPropagation()}>
      {inline ? (
        <div className="cost-results-header">
          <h2>Cost Comparison Results</h2>
        </div>
      ) : (
        <div className="modal-header">
          <h2>Cost Comparison Results</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
      )}

      <div className={inline ? "cost-results-body" : "modal-body"}>
          <div className="results-summary">
            <div className="summary-item">
              <span className="summary-label">Estimated Tokens:</span>
              <span className="summary-value">{estimatedTokens}</span>
            </div>
            {comparedModels.length > 0 && (
              <div className="summary-item">
                <span className="summary-label">Models compared:</span>
                <span className="summary-value">
                  {comparedModels.map((m) => `${m.model_name} (${m.provider})`).join(', ')}
                </span>
              </div>
            )}
            <div className="summary-item">
              <button 
                className="toggle-prompt-btn"
                onClick={() => setShowPrompt(!showPrompt)}
              >
                {showPrompt ? '▼' : '▶'} {showPrompt ? 'Hide' : 'Show'} Prompt
              </button>
            </div>
          </div>

          {showPrompt && (
            <div className="prompt-display">
              <span className="summary-label">Prompt:</span>
              <span className="summary-value">"{prompt}"</span>
            </div>
          )}

          {/* All Models Comparison */}
          {allModels && allModels.results.length > 1 && (
            <div className="comparison-section">
              <h3 className="comparison-title">All Models Comparison</h3>
              <div className="results-summary" style={{ marginBottom: 12 }}>
                <div className="summary-item">
                  <span className="summary-label">Models compared:</span>
                  <span className="summary-value">{allModels.results.length}</span>
                </div>
                <div className="summary-item">
                  <button
                    className="toggle-prompt-btn"
                    onClick={() => setShowAllComparedModels(!showAllComparedModels)}
                  >
                    {showAllComparedModels ? '▼' : '▶'} {showAllComparedModels ? 'Hide' : 'Show'} Models
                  </button>
                </div>
              </div>

              {showAllComparedModels && (
                <div className="prompt-display" style={{ marginBottom: 16 }}>
                  <span className="summary-label">Models compared (all):</span>
                  <span className="summary-value">
                    {allModels.results.map((m) => `${m.model_name} (${m.provider})`).join(', ')}
                  </span>
                </div>
              )}
              <div className="savings-banner">
                <div className="savings-content">
                  <span className="savings-icon"></span>
                  <div className="savings-text">
                    <strong>Save up to {allModels.savings.toFixed(1)}%</strong>
                    <span className="savings-amount">
                      ({formatPrice(allModels.savingsAmount)} savings by choosing the cheapest model)
                    </span>
                  </div>
                </div>
                <div className="savings-comparison">
                  <div className="price-comparison">
                    <span className="price-label">Cheapest:</span>
                    <span className="price-value cheapest">{formatPrice(allModels.cheapest.total_cost)}</span>
                    <span className="model-info">({allModels.cheapest.model_name} - {allModels.cheapest.provider})</span>
                  </div>
                  <div className="price-comparison">
                    <span className="price-label">Most Expensive:</span>
                    <span className="price-value expensive">{formatPrice(allModels.mostExpensive.total_cost)}</span>
                    <span className="model-info">({allModels.mostExpensive.model_name} - {allModels.mostExpensive.provider})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Models Comparison */}
          {selectedModels && selectedModels.results.length > 1 && (
            <div className="comparison-section">
              <h3 className="comparison-title">Selected Models Comparison</h3>
              <div className="savings-banner selected-comparison">
                <div className="savings-content">
                  <span className="savings-icon"></span>
                  <div className="savings-text">
                    <strong>Save up to {selectedModels.savings.toFixed(1)}%</strong>
                    <span className="savings-amount">
                      ({formatPrice(selectedModels.savingsAmount)} savings by choosing the cheapest model)
                    </span>
                  </div>
                </div>
                <div className="savings-comparison">
                  <div className="price-comparison">
                    <span className="price-label">Cheapest:</span>
                    <span className="price-value cheapest">{formatPrice(selectedModels.cheapest.total_cost)}</span>
                    <span className="model-info">({selectedModels.cheapest.model_name} - {selectedModels.cheapest.provider})</span>
                  </div>
                  <div className="price-comparison">
                    <span className="price-label">Most Expensive:</span>
                    <span className="price-value expensive">{formatPrice(selectedModels.mostExpensive.total_cost)}</span>
                    <span className="model-info">({selectedModels.mostExpensive.model_name} - {selectedModels.mostExpensive.provider})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bar Chart */}
          {chartData.length > 0 && (
            <div className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">Price Comparison Chart</h3>
                <button 
                  className="toggle-chart-btn"
                  onClick={() => setShowChart(!showChart)}
                >
                  {showChart ? '▼' : '▶'} {showChart ? 'Hide' : 'Show'} Chart
                </button>
              </div>
              {showChart && (
              <div className="bar-chart-container">
                {chartData.map((item, index) => {
                  const barHeight = (item.value / maxValue) * 100
                  const barColor = item.type === 'cheapest' 
                    ? '#4caf50' 
                    : item.type === 'mostExpensive' 
                    ? '#f44336' 
                    : '#2196f3'
                  
                  return (
                    <div key={index} className="bar-chart-item">
                      <div className="bar-chart-label">{item.label}</div>
                      <div className="bar-chart-bar-container">
                        <div 
                          className="bar-chart-bar"
                          style={{ 
                            height: `${barHeight}%`,
                            backgroundColor: barColor
                          }}
                          title={formatPrice(item.value)}
                        >
                          <span className="bar-value">{formatPrice(item.value)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
          )}

          {/* Results Table - Show all models */}
          {!hideAllModelsTable && allModels && (
            <div className="results-table-container">
              <h3 className="table-title">All Models (Sorted by Price)</h3>
              <table className="cost-results-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Model Name</th>
                    <th>Provider</th>
                    <th>Total Cost</th>
                    <th>Price/Token</th>
                    <th>MMLU Score</th>
                  </tr>
                </thead>
                <tbody>
                  {allModels.results.map((result, index) => (
                    <tr key={`${result.model_name}-${result.provider}-${index}`} className={index < 3 ? 'top-three' : ''}>
                      <td className="rank">
                        #{index + 1}
                      </td>
                      <td className="model-name">{result.model_name}</td>
                      <td>
                        <span className="provider-badge" data-provider={result.provider.toLowerCase()}>
                          {result.provider}
                        </span>
                      </td>
                      <td className="total-cost">
                        <strong>{formatPrice(result.total_cost)}</strong>
                      </td>
                      <td className="price-per-token">{formatPrice(result.price_per_token)}</td>
                      <td className="mmlu-score">
                        {result.mmlu_score !== null ? result.mmlu_score.toFixed(1) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )

  if (inline) {
    return content
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      {content}
    </div>
  )
}

export default CostResultsModal


