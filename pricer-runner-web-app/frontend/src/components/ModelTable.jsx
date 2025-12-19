import { useState, useMemo } from 'react'
import './ModelTable.css'

function ModelTable({ models, formatPrice, formatMMLU }) {
  const [filters, setFilters] = useState({
    modelName: '',
    provider: ''
  })
  const [priceSort, setPriceSort] = useState(null) // null, 'asc', 'desc'

  const filteredAndSortedModels = useMemo(() => {
    let filtered = models.filter(model => {
      // Model Name filter
      if (filters.modelName && !model.model_name.toLowerCase().includes(filters.modelName.toLowerCase())) {
        return false
      }

      // Provider filter
      if (filters.provider && !model.provider.toLowerCase().includes(filters.provider.toLowerCase())) {
        return false
      }

      return true
    })

    // Sort by price if sort is enabled
    if (priceSort) {
      filtered = [...filtered].sort((a, b) => {
        if (priceSort === 'asc') {
          return a.price_per_token - b.price_per_token
        } else {
          return b.price_per_token - a.price_per_token
        }
      })
    }

    return filtered
  }, [models, filters, priceSort])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePriceSort = () => {
    if (priceSort === null) {
      setPriceSort('asc') // Lowest first
    } else if (priceSort === 'asc') {
      setPriceSort('desc') // Highest first
    } else {
      setPriceSort(null) // No sort
    }
  }

  if (filteredAndSortedModels.length === 0) {
    return (
      <div className="no-models">
        No models found. Please check your filters.
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className="models-table">
        <thead>
          <tr>
            <th>
              <div className="filter-header-inline">
                <span>Model Name</span>
                <input
                  type="text"
                  placeholder="Search..."
                  value={filters.modelName}
                  onChange={(e) => handleFilterChange('modelName', e.target.value)}
                  className="column-filter-inline"
                />
              </div>
            </th>
            <th>
              <div className="filter-header-inline">
                <span>Provider</span>
                <input
                  type="text"
                  placeholder="Search..."
                  value={filters.provider}
                  onChange={(e) => handleFilterChange('provider', e.target.value)}
                  className="column-filter-inline"
                />
              </div>
            </th>
            <th>
              <div className="filter-header-inline">
                <span>Price per Token</span>
                <button 
                  className={`sort-button ${priceSort ? priceSort : ''}`}
                  onClick={handlePriceSort}
                  title={priceSort === 'asc' ? 'Sort: Lowest to Highest' : priceSort === 'desc' ? 'Sort: Highest to Lowest' : 'Click to sort by price'}
                >
                  {priceSort === 'asc' ? '↑' : priceSort === 'desc' ? '↓' : '⇅'}
                </button>
              </div>
            </th>
            <th>MMLU Score</th>
            <th>Model Size</th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedModels.map((model, index) => (
            <tr key={`${model.model_name}-${model.provider}-${index}`}>
              <td className="model-name">{model.model_name}</td>
              <td>
                <span className="provider-badge" data-provider={model.provider.toLowerCase()}>
                  {model.provider}
                </span>
              </td>
              <td className="price">{formatPrice(model.price_per_token)}</td>
              <td className="mmlu-score">
                {formatMMLU(model.mmlu_score)}
                {model.mmlu_score !== null && (
                  <span className="score-bar">
                    <span 
                      className="score-fill" 
                      style={{ width: `${model.mmlu_score}%` }}
                    ></span>
                  </span>
                )}
              </td>
              <td className="model-size">{model.model_size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ModelTable

