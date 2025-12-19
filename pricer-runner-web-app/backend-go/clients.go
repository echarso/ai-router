package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OpenAI Client
type OpenAIClient struct {
	APIKey    string
	ModelName string
	BaseURL   string
}

func NewOpenAIClient(apiKey, modelName string) *OpenAIClient {
	return &OpenAIClient{
		APIKey:    apiKey,
		ModelName: modelName,
		BaseURL:   "https://api.openai.com/v1/chat/completions",
	}
}

func (c *OpenAIClient) SendPrompt(prompt string) (string, error) {
	payload := map[string]interface{}{
		"model": c.ModelName,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"max_tokens": 1000,
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", c.BaseURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenAI API error: %s", string(body))
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	if choices, ok := result["choices"].([]interface{}); ok && len(choices) > 0 {
		if choice, ok := choices[0].(map[string]interface{}); ok {
			if message, ok := choice["message"].(map[string]interface{}); ok {
				if content, ok := message["content"].(string); ok {
					return content, nil
				}
			}
		}
	}

	return "", fmt.Errorf("unexpected response format")
}

func (c *OpenAIClient) GetModelName() string { return c.ModelName }
func (c *OpenAIClient) GetProvider() string  { return "OpenAI" }

// Anthropic Client
type AnthropicClient struct {
	APIKey    string
	ModelName string
	BaseURL   string
}

func NewAnthropicClient(apiKey, modelName string) *AnthropicClient {
	return &AnthropicClient{
		APIKey:    apiKey,
		ModelName: modelName,
		BaseURL:   "https://api.anthropic.com/v1/messages",
	}
}

func (c *AnthropicClient) SendPrompt(prompt string) (string, error) {
	payload := map[string]interface{}{
		"model":     c.ModelName,
		"max_tokens": 1000,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", c.BaseURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Anthropic API error: %s", string(body))
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	if content, ok := result["content"].([]interface{}); ok && len(content) > 0 {
		if text, ok := content[0].(map[string]interface{}); ok {
			if textContent, ok := text["text"].(string); ok {
				return textContent, nil
			}
		}
	}

	return "", fmt.Errorf("unexpected response format")
}

func (c *AnthropicClient) GetModelName() string { return c.ModelName }
func (c *AnthropicClient) GetProvider() string  { return "Anthropic" }

// Google Client
type GoogleClient struct {
	APIKey    string
	ModelName string
	BaseURL   string
}

func NewGoogleClient(apiKey, modelName string) *GoogleClient {
	return &GoogleClient{
		APIKey:    apiKey,
		ModelName: modelName,
		BaseURL:   "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent",
	}
}

func (c *GoogleClient) SendPrompt(prompt string) (string, error) {
	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]string{
					{"text": prompt},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s?key=%s", c.BaseURL, c.APIKey)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Google API error: %s", string(body))
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	if candidates, ok := result["candidates"].([]interface{}); ok && len(candidates) > 0 {
		if candidate, ok := candidates[0].(map[string]interface{}); ok {
			if content, ok := candidate["content"].(map[string]interface{}); ok {
				if parts, ok := content["parts"].([]interface{}); ok && len(parts) > 0 {
					if part, ok := parts[0].(map[string]interface{}); ok {
						if text, ok := part["text"].(string); ok {
							return text, nil
						}
					}
				}
			}
		}
	}

	return "", fmt.Errorf("unexpected response format")
}

func (c *GoogleClient) GetModelName() string { return c.ModelName }
func (c *GoogleClient) GetProvider() string  { return "Google" }

// AWS Client
type AWSClient struct {
	Secrets   AWSSecrets
	ModelName string
}

func NewAWSClient(secrets AWSSecrets, modelName string) *AWSClient {
	return &AWSClient{
		Secrets:   secrets,
		ModelName: modelName,
	}
}

func (c *AWSClient) SendPrompt(prompt string) (string, error) {
	// AWS Bedrock implementation would go here
	// This requires AWS SDK and proper authentication
	return "", fmt.Errorf("AWS Bedrock integration not yet implemented")
}

func (c *AWSClient) GetModelName() string { return c.ModelName }
func (c *AWSClient) GetProvider() string  { return "AWS" }

// Azure Client
type AzureClient struct {
	Secrets   AzureSecrets
	ModelName string
}

func NewAzureClient(secrets AzureSecrets, modelName string) *AzureClient {
	return &AzureClient{
		Secrets:   secrets,
		ModelName: modelName,
	}
}

func (c *AzureClient) SendPrompt(prompt string) (string, error) {
	// Azure OpenAI implementation would go here
	return "", fmt.Errorf("Azure OpenAI integration not yet implemented")
}

func (c *AzureClient) GetModelName() string { return c.ModelName }
func (c *AzureClient) GetProvider() string  { return "Azure" }

// Meta Client
type MetaClient struct {
	APIKey    string
	ModelName string
}

func NewMetaClient(apiKey, modelName string) *MetaClient {
	return &MetaClient{
		APIKey:    apiKey,
		ModelName: modelName,
	}
}

func (c *MetaClient) SendPrompt(prompt string) (string, error) {
	// Meta API implementation would go here
	return "", fmt.Errorf("Meta API integration not yet implemented")
}

func (c *MetaClient) GetModelName() string { return c.ModelName }
func (c *MetaClient) GetProvider() string  { return "Meta" }

// Mistral Client
type MistralClient struct {
	APIKey    string
	ModelName string
	BaseURL   string
}

func NewMistralClient(apiKey, modelName string) *MistralClient {
	return &MistralClient{
		APIKey:    apiKey,
		ModelName: modelName,
		BaseURL:   "https://api.mistral.ai/v1/chat/completions",
	}
}

func (c *MistralClient) SendPrompt(prompt string) (string, error) {
	payload := map[string]interface{}{
		"model": c.ModelName,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", c.BaseURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Mistral API error: %s", string(body))
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	if choices, ok := result["choices"].([]interface{}); ok && len(choices) > 0 {
		if choice, ok := choices[0].(map[string]interface{}); ok {
			if message, ok := choice["message"].(map[string]interface{}); ok {
				if content, ok := message["content"].(string); ok {
					return content, nil
				}
			}
		}
	}

	return "", fmt.Errorf("unexpected response format")
}

func (c *MistralClient) GetModelName() string { return c.ModelName }
func (c *MistralClient) GetProvider() string  { return "Mistral" }

