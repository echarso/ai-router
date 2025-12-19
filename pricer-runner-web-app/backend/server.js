const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const dataService = require('./dataService');
const fs = require('fs');
const path = require('path');
const { register, promptComparisonCounter, savingsPercentageGauge, promptCostHistogram } = require('./prometheus');

const app = express();
const PORT = process.env.PORT || 3001;

// Path to prompt history file - use /tmp in container or project root locally
const PROMPT_HISTORY_PATH = process.env.PROMPT_HISTORY_PATH || 
  (fs.existsSync(path.join(__dirname, '../../prompt_history.json')) 
    ? path.join(__dirname, '../../prompt_history.json')
    : '/tmp/prompt_history.json');

// Initialize prompt history file if it doesn't exist
function initializePromptHistory() {
  if (!fs.existsSync(PROMPT_HISTORY_PATH)) {
    fs.writeFileSync(PROMPT_HISTORY_PATH, JSON.stringify([], null, 2), 'utf8');
  }
}

// Load prompt history
function loadPromptHistory() {
  try {
    if (!fs.existsSync(PROMPT_HISTORY_PATH)) {
      return [];
    }
    const data = fs.readFileSync(PROMPT_HISTORY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading prompt history:', error);
    return [];
  }
}

// Save prompt to history
function savePromptToHistory(prompt, metadata = {}) {
  try {
    const history = loadPromptHistory();
    const entry = {
      timestamp: new Date().toISOString(),
      prompt: prompt,
      ...metadata
    };
    history.push(entry);
    fs.writeFileSync(PROMPT_HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving prompt to history:', error);
    return false;
  }
}

// Initialize on server start
initializePromptHistory();

// Middleware
app.use(cors());
app.use(express.json());

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /api/models:
 *   get:
 *     summary: Get all LLM models with pricing information
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: List of all models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       model_name:
 *                         type: string
 *                       price_per_token:
 *                         type: number
 *                       provider:
 *                         type: string
 *                       mmlu_score:
 *                         type: number
 *                       model_size:
 *                         type: string
 *       500:
 *         description: Server error
 */
app.get('/api/models', async (req, res) => {
  try {
    const models = await dataService.getAllModels();
    res.json({
      success: true,
      count: models.length,
      data: models
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch models'
    });
  }
});

/**
 * @swagger
 * /api/models/provider/{provider}:
 *   get:
 *     summary: Get models filtered by provider
 *     tags: [Models]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider name (e.g., OpenAI, Anthropic, Google, AWS, Azure, Meta, Mistral)
 *     responses:
 *       200:
 *         description: List of models for the specified provider
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 provider:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Server error
 */
app.get('/api/models/provider/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const models = await dataService.getModelsByProvider(provider);
    res.json({
      success: true,
      count: models.length,
      provider: provider,
      data: models
    });
  } catch (error) {
    console.error('Error fetching models by provider:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch models'
    });
  }
});

/**
 * @swagger
 * /api/providers:
 *   get:
 *     summary: Get list of all available providers
 *     tags: [Providers]
 *     responses:
 *       200:
 *         description: List of providers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Server error
 */
app.get('/api/providers', async (req, res) => {
  try {
    const models = await dataService.getAllModels();
    const providers = [...new Set(models.map(m => m.provider))].sort();
    res.json({
      success: true,
      count: providers.length,
      data: providers
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch providers'
    });
  }
});

/**
 * @swagger
 * /api/get_best_price_for_prompt:
 *   post:
 *     summary: Calculate the cost of a prompt across all models and return sorted by cheapest
 *     tags: [Cost Calculation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The prompt text to calculate cost for
 *                 example: "Write a story about a robot learning to paint"
 *     responses:
 *       200:
 *         description: Cost calculation results sorted by cheapest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 prompt:
 *                   type: string
 *                 estimated_tokens:
 *                   type: number
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       model_name:
 *                         type: string
 *                       provider:
 *                         type: string
 *                       price_per_token:
 *                         type: number
 *                       estimated_tokens:
 *                         type: number
 *                       total_cost:
 *                         type: number
 *                       mmlu_score:
 *                         type: number
 *                       model_size:
 *                         type: string
 *       400:
 *         description: Bad request - prompt is required
 *       500:
 *         description: Server error
 */
app.post('/api/get_best_price_for_prompt', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a non-empty string'
      });
    }

    // Save prompt to history
    savePromptToHistory(prompt.trim(), {
      action: 'cost_calculation',
      estimated_tokens: Math.ceil(prompt.trim().length / 4)
    });

    const models = await dataService.getAllModels();
    
    // Estimate token count (roughly 1 token ≈ 4 characters for English)
    // This is a simple approximation; in production, you'd use a proper tokenizer
    const estimatedTokens = Math.ceil(prompt.trim().length / 4);
    
    // Calculate cost for each model
    const costResults = models.map(model => {
      const totalCost = model.price_per_token * estimatedTokens;
      return {
        model_name: model.model_name,
        provider: model.provider,
        price_per_token: model.price_per_token,
        estimated_tokens: estimatedTokens,
        total_cost: totalCost,
        mmlu_score: model.mmlu_score,
        model_size: model.model_size
      };
    });

    // Sort by total cost (cheapest first)
    costResults.sort((a, b) => a.total_cost - b.total_cost);

    // Calculate savings percentage
    const cheapest = costResults[0];
    const mostExpensive = costResults[costResults.length - 1];
    const savingsPercentage = mostExpensive.total_cost > 0 
      ? ((mostExpensive.total_cost - cheapest.total_cost) / mostExpensive.total_cost) * 100 
      : 0;

    // Record metrics
    promptComparisonCounter.inc({ provider: cheapest.provider });
    savingsPercentageGauge.set({ comparison_type: 'all_models' }, savingsPercentage);
    
    // Record cost for each model
    costResults.forEach(result => {
      promptCostHistogram.observe(
        { model_name: result.model_name, provider: result.provider },
        result.total_cost
      );
    });

    res.json({
      success: true,
      prompt: prompt,
      estimated_tokens: estimatedTokens,
      count: costResults.length,
      data: costResults,
      savings_percentage: savingsPercentage
    });
  } catch (error) {
    console.error('Error getting best price for prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get best price for prompt'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available:`);
  console.log(`   GET /api/models - Get all models`);
  console.log(`   GET /api/models/provider/:provider - Get models by provider`);
  console.log(`   GET /api/providers - Get list of providers`);
  console.log(`   POST /api/get_best_price_for_prompt - Get best price for prompt across all models`);
  console.log(`   GET /health - Health check`);
  console.log(`📚 Swagger API documentation: http://localhost:${PORT}/api-docs`);
});

