#!/usr/bin/env python3
"""
Script to generate a list of LLM models with their prices, providers, MMLU scores, and model sizes.
Outputs the data to a CSV file.
"""

import csv

# Model data: (model_name, price_per_token_input, price_per_token_output, provider, mmlu_score, model_size)
# Prices are in USD per 1M tokens (we'll convert to per token)
MODELS = [
    # OpenAI Models
    ("gpt-4o", 2.50, 10.00, "OpenAI", 88.7, "Unknown"),
    ("gpt-4o-mini", 0.15, 0.60, "OpenAI", 79.0, "Unknown"),
    ("gpt-4-turbo", 10.00, 30.00, "OpenAI", 86.4, "Unknown"),
    ("gpt-4", 30.00, 60.00, "OpenAI", 86.4, "Unknown"),
    ("gpt-3.5-turbo", 0.50, 1.50, "OpenAI", 70.0, "175B"),
    
    # Anthropic Models
    ("claude-3-5-sonnet-20241022", 3.00, 15.00, "Anthropic", 88.7, "Unknown"),
    ("claude-3-opus-20240229", 15.00, 75.00, "Anthropic", 86.8, "Unknown"),
    ("claude-3-sonnet-20240229", 3.00, 15.00, "Anthropic", 84.9, "Unknown"),
    ("claude-3-haiku-20240307", 0.25, 1.25, "Anthropic", 75.2, "Unknown"),
    ("claude-2.1", 8.00, 24.00, "Anthropic", 78.5, "Unknown"),
    
    # Google Models
    ("gemini-1.5-pro", 1.25, 5.00, "Google", 83.7, "Unknown"),
    ("gemini-1.5-flash", 0.075, 0.30, "Google", 78.5, "Unknown"),
    ("gemini-pro", 0.50, 1.50, "Google", 72.6, "Unknown"),
    ("paLM-2", 1.00, 1.00, "Google", 78.3, "340B"),
    
    # AWS Bedrock Models
    ("anthropic.claude-3-5-sonnet-20241022-v2:0", 3.00, 15.00, "AWS", 88.7, "Unknown"),
    ("anthropic.claude-3-opus-20240229-v1:0", 15.00, 75.00, "AWS", 86.8, "Unknown"),
    ("anthropic.claude-3-sonnet-20240229-v1:0", 3.00, 15.00, "AWS", 84.9, "Unknown"),
    ("amazon.titan-text-premier-v1:0", 0.80, 0.80, "AWS", 75.0, "Unknown"),
    ("amazon.titan-text-lite-v1", 0.20, 0.20, "AWS", 68.0, "Unknown"),
    ("ai21.j2-ultra-v1", 18.00, 18.00, "AWS", 79.0, "Unknown"),
    ("ai21.j2-mid-v1", 12.50, 12.50, "AWS", 72.0, "Unknown"),
    
    # Azure Models (same as OpenAI typically)
    ("gpt-4o", 2.50, 10.00, "Azure", 88.7, "Unknown"),
    ("gpt-4-turbo", 10.00, 30.00, "Azure", 86.4, "Unknown"),
    ("gpt-4", 30.00, 60.00, "Azure", 86.4, "Unknown"),
    ("gpt-35-turbo", 0.50, 1.50, "Azure", 70.0, "175B"),
    
    # Meta Models
    ("llama-3-70b", 0.59, 0.79, "Meta", 82.0, "70B"),
    ("llama-3-8b", 0.05, 0.05, "Meta", 66.6, "8B"),
    ("llama-2-70b", 0.65, 0.65, "Meta", 69.8, "70B"),
    ("llama-2-13b", 0.15, 0.15, "Meta", 54.8, "13B"),
    ("llama-2-7b", 0.10, 0.10, "Meta", 45.3, "7B"),
    
    # Mistral AI Models
    ("mistral-large-2407", 2.70, 8.10, "Mistral", 81.2, "Unknown"),
    ("mistral-medium-2312", 2.70, 8.10, "Mistral", 75.3, "Unknown"),
    ("mistral-small-2409", 0.20, 0.60, "Mistral", 72.2, "Unknown"),
    ("mistral-tiny", 0.14, 0.14, "Mistral", 61.0, "7B"),
]

def generate_csv(filename="llm_models_pricing.csv"):
    """
    Generate a CSV file with LLM model information.
    
    Args:
        filename: Output CSV filename
    """
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['model_name', 'price_per_token', 'provider', 'mmlu_score', 'model_size']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        
        for model_name, price_input, price_output, provider, mmlu_score, model_size in MODELS:
            # Convert price from per 1M tokens to per token (using input price as primary)
            price_per_token = price_input / 1_000_000
            
            writer.writerow({
                'model_name': model_name,
                'price_per_token': f"{price_per_token:.10f}",
                'provider': provider,
                'mmlu_score': mmlu_score if mmlu_score else "N/A",
                'model_size': model_size if model_size else "Unknown"
            })
    
    print(f"✓ Generated CSV file: {filename}")
    print(f"✓ Total models: {len(MODELS)}")
    print(f"✓ Providers included: {', '.join(sorted(set(m[3] for m in MODELS)))}")

if __name__ == "__main__":
    generate_csv()

