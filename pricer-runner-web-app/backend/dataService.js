/**
 * Data Service Layer
 * This abstraction allows easy switching between CSV and database sources
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

class DataService {
  constructor() {
    // Try multiple paths for CSV file
    const possiblePaths = [
      path.join(__dirname, '../../llm_models_pricing.csv'),
      path.join(__dirname, 'llm_models_pricing.csv'),
      '/app/llm_models_pricing.csv'
    ];
    
    // Use the first path that exists, or default to the first one
    this.csvPath = possiblePaths.find(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || possiblePaths[0];
  }

  /**
   * Get all models from the data source
   * @returns {Promise<Array>} Array of model objects
   */
  async getAllModels() {
    // Currently reads from CSV
    // In the future, this can be replaced with a database query
    return this._readFromCSV();
  }

  /**
   * Get models filtered by provider
   * @param {string} provider - Provider name
   * @returns {Promise<Array>} Array of model objects
   */
  async getModelsByProvider(provider) {
    const allModels = await this.getAllModels();
    return allModels.filter(model => 
      model.provider.toLowerCase() === provider.toLowerCase()
    );
  }

  /**
   * Read models from CSV file
   * @private
   * @returns {Promise<Array>} Array of model objects
   */
  async _readFromCSV() {
    try {
      const fileContent = fs.readFileSync(this.csvPath, 'utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      // Convert price_per_token to number and ensure proper types
      return records.map(record => ({
        model_name: record.model_name,
        price_per_token: parseFloat(record.price_per_token),
        provider: record.provider,
        mmlu_score: record.mmlu_score === 'N/A' ? null : parseFloat(record.mmlu_score),
        model_size: record.model_size
      }));
    } catch (error) {
      console.error('Error reading CSV file:', error);
      throw new Error('Failed to read model data');
    }
  }

  /**
   * Future method: Get models from database
   * This is a placeholder for when database integration is needed
   * @private
   * @returns {Promise<Array>} Array of model objects
   */
  async _readFromDatabase() {
    // TODO: Implement database query
    // Example:
    // const db = require('./database');
    // return await db.query('SELECT * FROM models');
    throw new Error('Database integration not yet implemented');
  }
}

module.exports = new DataService();

