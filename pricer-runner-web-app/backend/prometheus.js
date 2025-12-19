const client = require('prom-client');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'price-runner-backend'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Create custom metrics
const promptComparisonCounter = new client.Counter({
  name: 'prompt_comparisons_total',
  help: 'Total number of prompt comparisons performed',
  labelNames: ['provider'],
  registers: [register]
});

const savingsPercentageGauge = new client.Gauge({
  name: 'prompt_savings_percentage',
  help: 'Savings percentage for each prompt comparison',
  labelNames: ['comparison_type'], // 'all_models' or 'selected_models'
  registers: [register]
});

const promptCostHistogram = new client.Histogram({
  name: 'prompt_cost_usd',
  help: 'Cost of prompts in USD',
  labelNames: ['model_name', 'provider'],
  buckets: [0.001, 0.01, 0.1, 1, 10, 100],
  registers: [register]
});

module.exports = {
  register,
  promptComparisonCounter,
  savingsPercentageGauge,
  promptCostHistogram
};

