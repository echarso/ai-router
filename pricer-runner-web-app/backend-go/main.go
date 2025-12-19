package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

// Model represents a pricing model
type Model struct {
	ModelName      string  `json:"model_name"`
	PricePerToken  float64 `json:"price_per_token"`
	Provider       string  `json:"provider"`
	MMLUScore      *float64 `json:"mmlu_score"`
	ModelSize      string  `json:"model_size"`
}

// Secrets represents the API keys configuration
type Secrets struct {
	OpenAI   OpenAISecrets   `yaml:"openai"`
	Anthropic AnthropicSecrets `yaml:"anthropic"`
	Google   GoogleSecrets   `yaml:"google"`
	AWS      AWSSecrets      `yaml:"aws"`
	Azure    AzureSecrets    `yaml:"azure"`
	Meta     MetaSecrets     `yaml:"meta"`
	Mistral  MistralSecrets  `yaml:"mistral"`
}

type OpenAISecrets struct {
	APIKey string `yaml:"api_key"`
}

type AnthropicSecrets struct {
	APIKey string `yaml:"api_key"`
}

type GoogleSecrets struct {
	APIKey string `yaml:"api_key"`
}

type AWSSecrets struct {
	AccessKeyID     string `yaml:"access_key_id"`
	SecretAccessKey string `yaml:"secret_access_key"`
	Region          string `yaml:"region"`
}

type AzureSecrets struct {
	APIKey    string `yaml:"api_key"`
	Endpoint  string `yaml:"endpoint"`
	APIVersion string `yaml:"api_version"`
}

type MetaSecrets struct {
	APIKey string `yaml:"api_key"`
}

type MistralSecrets struct {
	APIKey string `yaml:"api_key"`
}

// PromptRequest represents a request to calculate prompt cost
type PromptRequest struct {
	Prompt string `json:"prompt" binding:"required"`
}

// PromptResponse represents the response with cost calculations
type PromptResponse struct {
	Success        bool     `json:"success"`
	Prompt         string   `json:"prompt"`
	EstimatedTokens int     `json:"estimated_tokens"`
	Count          int      `json:"count"`
	Data           []ModelCost `json:"data"`
}

// ModelCost represents cost calculation for a model
type ModelCost struct {
	ModelName      string   `json:"model_name"`
	Provider       string   `json:"provider"`
	PricePerToken  float64  `json:"price_per_token"`
	EstimatedTokens int     `json:"estimated_tokens"`
	TotalCost      float64  `json:"total_cost"`
	MMLUScore      *float64 `json:"mmlu_score"`
	ModelSize      string   `json:"model_size"`
}

// LLMClient interface for different model providers
type LLMClient interface {
	SendPrompt(prompt string) (string, error)
	GetModelName() string
	GetProvider() string
}

var secrets Secrets
var models []Model

func main() {
	// Load secrets
	if err := loadSecrets(); err != nil {
		log.Printf("Warning: Could not load secrets.yaml: %v", err)
		log.Println("Continuing without API keys - cost calculation only")
	}

	// Load models from CSV
	if err := loadModels(); err != nil {
		log.Fatalf("Failed to load models: %v", err)
	}

	// Setup router
	router := gin.Default()

	// CORS middleware
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	router.Use(cors.New(config))

	// Routes
	api := router.Group("/api")
	{
		api.GET("/models", getModels)
		api.GET("/models/provider/:provider", getModelsByProvider)
		api.GET("/providers", getProviders)
		api.POST("/get_best_price_for_prompt", getBestPriceForPrompt)
		api.POST("/send_prompt", sendPromptToModels)
	}

	router.GET("/health", healthCheck)
	router.GET("/api-docs", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Swagger documentation available at /api-docs",
			"endpoints": []string{
				"GET /api/models",
				"GET /api/models/provider/:provider",
				"GET /api/providers",
				"POST /api/get_best_price_for_prompt",
				"POST /api/send_prompt",
				"GET /health",
			},
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("🚀 Go Backend server running on http://localhost:%s", port)
	log.Fatal(router.Run(":" + port))
}

func loadSecrets() error {
	secretPath := filepath.Join("..", "..", "secrets.yaml")
	if _, err := os.Stat(secretPath); os.IsNotExist(err) {
		return fmt.Errorf("secrets.yaml not found at %s", secretPath)
	}

	data, err := os.ReadFile(secretPath)
	if err != nil {
		return err
	}

	return yaml.Unmarshal(data, &secrets)
}

func loadModels() error {
	csvPath := filepath.Join("..", "..", "llm_models_pricing.csv")
	file, err := os.Open(csvPath)
	if err != nil {
		return err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return err
	}

	if len(records) < 2 {
		return fmt.Errorf("CSV file is empty or has no data rows")
	}

	// Parse header
	header := records[0]
	models = []Model{}

	// Parse data rows
	for i := 1; i < len(records); i++ {
		record := records[i]
		if len(record) < 5 {
			continue
		}

		pricePerToken, _ := strconv.ParseFloat(record[1], 64)
		
		var mmluScore *float64
		if record[3] != "N/A" && record[3] != "" {
			score, err := strconv.ParseFloat(record[3], 64)
			if err == nil {
				mmluScore = &score
			}
		}

		model := Model{
			ModelName:     record[0],
			PricePerToken: pricePerToken,
			Provider:      record[2],
			MMLUScore:     mmluScore,
			ModelSize:     record[4],
		}
		models = append(models, model)
	}

	return nil
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func getModels(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(models),
		"data":    models,
	})
}

func getModelsByProvider(c *gin.Context) {
	provider := c.Param("provider")
	var filtered []Model

	for _, model := range models {
		if strings.EqualFold(model.Provider, provider) {
			filtered = append(filtered, model)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(filtered),
		"provider": provider,
		"data":    filtered,
	})
}

func getProviders(c *gin.Context) {
	providerMap := make(map[string]bool)
	for _, model := range models {
		providerMap[model.Provider] = true
	}

	providers := []string{}
	for provider := range providerMap {
		providers = append(providers, provider)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(providers),
		"data":    providers,
	})
}

func getBestPriceForPrompt(c *gin.Context) {
	var req PromptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Prompt is required and must be a non-empty string",
		})
		return
	}

	// Estimate token count (roughly 1 token ≈ 4 characters)
	estimatedTokens := (len(req.Prompt) + 3) / 4

	// Calculate cost for each model
	var costResults []ModelCost
	for _, model := range models {
		totalCost := model.PricePerToken * float64(estimatedTokens)
		costResults = append(costResults, ModelCost{
			ModelName:      model.ModelName,
			Provider:       model.Provider,
			PricePerToken:  model.PricePerToken,
			EstimatedTokens: estimatedTokens,
			TotalCost:      totalCost,
			MMLUScore:      model.MMLUScore,
			ModelSize:      model.ModelSize,
		})
	}

	// Sort by total cost (cheapest first)
	for i := 0; i < len(costResults)-1; i++ {
		for j := i + 1; j < len(costResults); j++ {
			if costResults[i].TotalCost > costResults[j].TotalCost {
				costResults[i], costResults[j] = costResults[j], costResults[i]
			}
		}
	}

	c.JSON(http.StatusOK, PromptResponse{
		Success:        true,
		Prompt:         req.Prompt,
		EstimatedTokens: estimatedTokens,
		Count:          len(costResults),
		Data:           costResults,
	})
}

// sendPromptToModels sends the prompt to actual LLM providers and returns responses
func sendPromptToModels(c *gin.Context) {
	var req struct {
		Prompt      string   `json:"prompt" binding:"required"`
		ModelNames  []string `json:"model_names,omitempty"` // Optional: specific models to use
		Providers   []string `json:"providers,omitempty"`   // Optional: specific providers to use
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Prompt is required",
		})
		return
	}

	// Filter models based on request
	var modelsToUse []Model
	if len(req.ModelNames) > 0 || len(req.Providers) > 0 {
		for _, model := range models {
			if len(req.ModelNames) > 0 {
				for _, name := range req.ModelNames {
					if model.ModelName == name {
						modelsToUse = append(modelsToUse, model)
						break
					}
				}
			} else if len(req.Providers) > 0 {
				for _, provider := range req.Providers {
					if strings.EqualFold(model.Provider, provider) {
						modelsToUse = append(modelsToUse, model)
						break
					}
				}
			}
		}
	} else {
		modelsToUse = models
	}

	// Send prompt to each model
	responses := []map[string]interface{}{}
	for _, model := range modelsToUse {
		client := getLLMClient(model)
		if client == nil {
			continue
		}

		response, err := client.SendPrompt(req.Prompt)
		if err != nil {
			responses = append(responses, map[string]interface{}{
				"model_name": model.ModelName,
				"provider":   model.Provider,
				"success":    false,
				"error":      err.Error(),
			})
			continue
		}

		responses = append(responses, map[string]interface{}{
			"model_name": model.ModelName,
			"provider":   model.Provider,
			"success":    true,
			"response":   response,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(responses),
		"data":    responses,
	})
}

// getLLMClient returns the appropriate LLM client based on the model
func getLLMClient(model Model) LLMClient {
	switch strings.ToLower(model.Provider) {
	case "openai":
		if secrets.OpenAI.APIKey != "" {
			return NewOpenAIClient(secrets.OpenAI.APIKey, model.ModelName)
		}
	case "anthropic":
		if secrets.Anthropic.APIKey != "" {
			return NewAnthropicClient(secrets.Anthropic.APIKey, model.ModelName)
		}
	case "google":
		if secrets.Google.APIKey != "" {
			return NewGoogleClient(secrets.Google.APIKey, model.ModelName)
		}
	case "aws":
		if secrets.AWS.AccessKeyID != "" {
			return NewAWSClient(secrets.AWS, model.ModelName)
		}
	case "azure":
		if secrets.Azure.APIKey != "" {
			return NewAzureClient(secrets.Azure, model.ModelName)
		}
	case "meta":
		if secrets.Meta.APIKey != "" {
			return NewMetaClient(secrets.Meta.APIKey, model.ModelName)
		}
	case "mistral":
		if secrets.Mistral.APIKey != "" {
			return NewMistralClient(secrets.Mistral.APIKey, model.ModelName)
		}
	}
	return nil
}

