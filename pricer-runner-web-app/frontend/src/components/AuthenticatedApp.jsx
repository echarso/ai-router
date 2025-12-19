import { useState, useEffect } from 'react';
import ModelTable from './ModelTable';
import PromptCostCalculator from './PromptCostCalculator';
import GrafanaChart from './GrafanaChart';
import CostResultsModal from './CostResultsModal';
import ThemeSelector from './ThemeSelector';
import SideNav from './SideNav';
import ApiKeyManagement from './ApiKeyManagement';
import OrganizationManagement from './OrganizationManagement';
import OrganizationPanel from './OrganizationPanel';
import { useAuth } from '../contexts/AuthContext';
import '../themes/themeStyles.css';
import '../App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const POLL_INTERVAL = 5000; // Poll every 5 seconds

function AuthenticatedApp() {
  const { getToken, isSystemOwner, isSystemAdmin, isOrganizationAdmin } = useAuth();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [providers, setProviders] = useState([]);
  const [costResults, setCostResults] = useState(null);
  const [costPrompt, setCostPrompt] = useState('');
  const [calculatingCost, setCalculatingCost] = useState(false);
  const [aiResponse, setAIResponse] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'modern';
  });
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('view') || 'home';
  });

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('view', currentView);
  }, [currentView]);

  const fetchModels = async () => {
    try {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await fetch(`${API_BASE_URL}/models`, { headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setModels(data.data || data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching models:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await fetch(`${API_BASE_URL}/providers`, { headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setProviders(data.data || data);
    } catch (err) {
      console.error('Error fetching providers:', err);
    }
  };

  useEffect(() => {
    fetchModels();
    fetchProviders();
    const interval = setInterval(fetchModels, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return 'N/A';
    return `$${price.toFixed(8)}`;
  };

  const formatMMLU = (score) => {
    if (score === null || score === undefined) return 'N/A';
    // Keep one decimal place like the original app
    return Number(score).toFixed(1);
  };

  const formatCost = (cost) => {
    if (cost === null || cost === undefined) return 'N/A';
    if (cost < 0.0001) return `$${cost.toFixed(10)}`;
    if (cost < 1) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const handleGetAIAnswer = async (prompt, selectedModels = []) => {
    try {
      const token = await getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      
      const response = await fetch(`${API_BASE_URL}/get_best_price_for_prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setAIResponse(data);
    } catch (err) {
      console.error('Error getting AI answer:', err);
      setError(err.message);
    }
  };

  const handleCalculateCost = async (prompt, selectedModels = []) => {
    if (!prompt || !prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setCostPrompt(prompt);
    setCalculatingCost(true);
    setError(null);

    try {
      const token = await getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      
      const response = await fetch(`${API_BASE_URL}/get_best_price_for_prompt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to calculate cost');
      }

      const allModelsResults = result.data || [];
      if (allModelsResults.length === 0) {
        throw new Error('No models available');
      }

      const allCheapest = allModelsResults[0];
      const allMostExpensive = allModelsResults[allModelsResults.length - 1];
      const allSavings =
        allMostExpensive.total_cost > 0
          ? ((allMostExpensive.total_cost - allCheapest.total_cost) / allMostExpensive.total_cost) * 100
          : 0;

      // Selected models comparison (if any selected)
      let selectedModelsComparison = null;
      if (selectedModels.length > 0) {
        const selectedResults = allModelsResults.filter((r) =>
          selectedModels.some((sm) => sm.model_name === r.model_name && sm.provider === r.provider)
        );

        if (selectedResults.length > 0) {
          const selectedSorted = [...selectedResults].sort((a, b) => a.total_cost - b.total_cost);
          const selectedCheapest = selectedSorted[0];
          const selectedMostExpensive = selectedSorted[selectedSorted.length - 1];
          const selectedSavings =
            selectedMostExpensive.total_cost > 0
              ? ((selectedMostExpensive.total_cost - selectedCheapest.total_cost) / selectedMostExpensive.total_cost) *
                100
              : 0;

          selectedModelsComparison = {
            results: selectedSorted,
            cheapest: selectedCheapest,
            mostExpensive: selectedMostExpensive,
            savings: selectedSavings,
            savingsAmount: selectedMostExpensive.total_cost - selectedCheapest.total_cost,
          };
        }
      }

      setCostResults({
        allModels: {
          results: allModelsResults,
          cheapest: allCheapest,
          mostExpensive: allMostExpensive,
          savings: allSavings,
          savingsAmount: allMostExpensive.total_cost - allCheapest.total_cost,
        },
        selectedModels: selectedModelsComparison,
        comparedModels: selectedModels?.length
          ? selectedModels.map((m) => ({ model_name: m.model_name, provider: m.provider }))
          : [],
      });
    } catch (err) {
      console.error('Error calculating cost:', err);
      setError(err.message);
    } finally {
      setCalculatingCost(false);
    }
  };

  return (
    <div className="app">
      <SideNav
        currentView={currentView}
        onViewChange={setCurrentView}
        currentTheme={theme}
        onThemeChange={setTheme}
        lastUpdated={lastUpdated}
        pollInterval={POLL_INTERVAL}
        isSystemOwner={isSystemOwner() || isSystemAdmin()}
        isOrganizationAdmin={isOrganizationAdmin()}
      />
      <div className="main-content">
        <header className="app-header">
          <h1>Smart Inference Scheduling</h1>
          <p className="subtitle">Real-time pricing information for Large Language Models</p>
        </header>

        {currentView === 'home' && (
          <>
            {loading && <div className="loading">Loading models...</div>}
            {error && <div className="error">Error: {error}</div>}
            {!loading && !error && (
              <ModelTable
                models={models}
                formatPrice={formatPrice}
                formatMMLU={formatMMLU}
              />
            )}
          </>
        )}

        {currentView === 'playground' && (
          <div className="playground-split-container">
            <div className="playground-left-panel">
              {error && <div className="error">Error: {error}</div>}
              <PromptCostCalculator onCalculate={handleCalculateCost} allModels={models} onGetAIAnswer={handleGetAIAnswer} />
            </div>
            <div className="playground-right-panel">
              {costResults ? (
                <CostResultsModal
                  results={costResults}
                  prompt={costPrompt}
                  formatPrice={formatCost}
                  onClose={() => setCostResults(null)}
                  inline={true}
                  hideAllModelsTable={true}
                />
              ) : (
                <div className="no-results-placeholder">
                  <p>Submit a prompt to see results here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'api-keys' && <ApiKeyManagement />}

        {currentView === 'organization' && <OrganizationPanel />}

        {currentView === 'organizations' && (isSystemOwner() || isSystemAdmin()) && <OrganizationManagement />}

        {currentView === 'grafana' && <GrafanaChart />}

        {/* Cost results are shown inline in the playground right panel */}
      </div>
    </div>
  );
}

export default AuthenticatedApp;
