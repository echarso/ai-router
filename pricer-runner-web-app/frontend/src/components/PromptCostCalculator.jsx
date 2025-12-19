import { useState, useRef, useEffect } from 'react'
import './PromptCostCalculator.css'

function PromptCostCalculator({ onCalculate, allModels, onGetAIAnswer }) {
  const [prompt, setPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [tryAIAnswer, setTryAIAnswer] = useState(false)
  const dropdownRef = useRef(null)

  // Get unique models for selection
  const uniqueModels = allModels ? [...new Map(allModels.map(m => [`${m.model_name}-${m.provider}`, m])).values()] : []

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleModelToggle = (modelName, provider) => {
    setSelectedModels(prev => {
      if (prev.some(m => m.model_name === modelName && m.provider === provider)) {
        return prev.filter(m => !(m.model_name === modelName && m.provider === provider))
      } else {
        return [...prev, { model_name: modelName, provider }]
      }
    })
  }

  const removeModel = (modelName, provider) => {
    setSelectedModels(prev => prev.filter(m => !(m.model_name === modelName && m.provider === provider)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!prompt.trim()) {
      return
    }
    
    setIsSubmitting(true)
    
    // If "Try AI Answer" is checked, get AI response from best model
    if (tryAIAnswer && onGetAIAnswer) {
      await onGetAIAnswer(prompt.trim(), selectedModels)
    }
    
    // Always calculate costs
    await onCalculate(prompt.trim(), selectedModels)
    setIsSubmitting(false)
  }

  return (
    <div className="prompt-calculator">
      <h2>Calculate Prompt Cost</h2>
      <form onSubmit={handleSubmit} className="prompt-form">
        <div className="model-selector-section">
          <label className="model-selector-label">
            Select Models to Compare (Optional - leave empty to compare all models):
          </label>
          <div className="multiselect-dropdown" ref={dropdownRef}>
            <div 
              className="multiselect-trigger"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="multiselect-placeholder">
                {selectedModels.length > 0 
                  ? `${selectedModels.length} model(s) selected`
                  : 'Click to select models...'}
              </span>
              <span className="multiselect-arrow">{isDropdownOpen ? '▲' : '▼'}</span>
            </div>
            {isDropdownOpen && (
              <div className="multiselect-options">
                {uniqueModels.map((model) => {
                  const isSelected = selectedModels.some(m => m.model_name === model.model_name && m.provider === model.provider)
                  return (
                    <label key={`${model.model_name}-${model.provider}`} className="multiselect-option">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleModelToggle(model.model_name, model.provider)}
                        className="multiselect-checkbox"
                      />
                      <span className="multiselect-option-text">
                        {model.model_name} ({model.provider})
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            {selectedModels.length > 0 && (
              <div className="selected-models-tags">
                {selectedModels.map((model, index) => (
                  <span key={`${model.model_name}-${model.provider}-${index}`} className="selected-model-tag">
                    {model.model_name} ({model.provider})
                    <button
                      type="button"
                      className="remove-model-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeModel(model.model_name, model.provider)
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <textarea
          className="prompt-input"
          placeholder="Enter your prompt here to calculate the cost across all models..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
        />
        <div className="ai-answer-option">
          <label className="ai-answer-checkbox-label">
            <input
              type="checkbox"
              checked={tryAIAnswer}
              onChange={(e) => setTryAIAnswer(e.target.checked)}
              className="ai-answer-checkbox"
            />
            <span className="ai-answer-label-text">Try AI answer from the best AI model</span>
          </label>
        </div>
        <div className="prompt-actions">
          <div className="char-count">
            {prompt.length} characters (≈ {Math.ceil(prompt.length / 4)} tokens)
          </div>
          <button 
            type="submit" 
            className="submit-button"
            disabled={!prompt.trim() || isSubmitting}
          >
            {isSubmitting ? 'Calculating...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PromptCostCalculator

