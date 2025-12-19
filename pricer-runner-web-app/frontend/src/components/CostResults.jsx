import './CostResults.css'

function CostResults({ results, prompt, formatPrice }) {
  if (!results || results.length === 0) {
    return null
  }

  return (
    <div className="cost-results">
      <div className="results-header">
        <h3>💰 Cost Comparison for Your Prompt</h3>
        <div className="results-summary">
          <span>Prompt: "{prompt.substring(0, 50)}{prompt.length > 50 ? '...' : ''}"</span>
          <span>Estimated Tokens: {results[0]?.estimated_tokens || 0}</span>
        </div>
      </div>
      
      <div className="results-table-container">
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
            {results.map((result, index) => (
              <tr key={`${result.model_name}-${result.provider}-${index}`} className={index < 3 ? 'top-three' : ''}>
                <td className="rank">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index >= 3 && `#${index + 1}`}
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
    </div>
  )
}

export default CostResults

