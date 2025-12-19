"""
Price Runner Backend - Python Implementation
Flask-based REST API for LLM model pricing and prompt routing
"""

import csv
import os
import yaml
from pathlib import Path
from typing import List, Dict, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global variables
models: List[Dict] = []
secrets: Dict = {}


class LLMClient:
    """Base class for LLM provider clients"""
    
    def __init__(self, model_name: str, provider: str):
        self.model_name = model_name
        self.provider = provider
    
    def send_prompt(self, prompt: str) -> str:
        """Send prompt to the LLM and return response"""
        raise NotImplementedError
    
    def get_model_name(self) -> str:
        return self.model_name
    
    def get_provider(self) -> str:
        return self.provider


class OpenAIClient(LLMClient):
    """OpenAI API client"""
    
    def __init__(self, api_key: str, model_name: str):
        super().__init__(model_name, "OpenAI")
        self.api_key = api_key
        self.base_url = "https://api.openai.com/v1/chat/completions"
    
    def send_prompt(self, prompt: str) -> str:
        import requests
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1000
        }
        
        response = requests.post(self.base_url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


class AnthropicClient(LLMClient):
    """Anthropic Claude API client"""
    
    def __init__(self, api_key: str, model_name: str):
        super().__init__(model_name, "Anthropic")
        self.api_key = api_key
        self.base_url = "https://api.anthropic.com/v1/messages"
    
    def send_prompt(self, prompt: str) -> str:
        import requests
        
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model_name,
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": prompt}]
        }
        
        response = requests.post(self.base_url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()["content"][0]["text"]


class GoogleClient(LLMClient):
    """Google Gemini API client"""
    
    def __init__(self, api_key: str, model_name: str):
        super().__init__(model_name, "Google")
        self.api_key = api_key
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
    
    def send_prompt(self, prompt: str) -> str:
        import requests
        
        url = f"{self.base_url}?key={self.api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]


class MistralClient(LLMClient):
    """Mistral AI API client"""
    
    def __init__(self, api_key: str, model_name: str):
        super().__init__(model_name, "Mistral")
        self.api_key = api_key
        self.base_url = "https://api.mistral.ai/v1/chat/completions"
    
    def send_prompt(self, prompt: str) -> str:
        import requests
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}]
        }
        
        response = requests.post(self.base_url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


def load_secrets() -> Dict:
    """Load API keys from secrets.yaml"""
    secret_path = Path(__file__).parent.parent.parent / "secrets.yaml"
    
    if not secret_path.exists():
        print(f"Warning: secrets.yaml not found at {secret_path}")
        return {}
    
    with open(secret_path, 'r') as f:
        return yaml.safe_load(f) or {}


def load_models() -> List[Dict]:
    """Load models from CSV file"""
    csv_path = Path(__file__).parent.parent.parent / "llm_models_pricing.csv"
    
    models_list = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            mmlu_score = None
            if row['mmlu_score'] and row['mmlu_score'] != 'N/A':
                try:
                    mmlu_score = float(row['mmlu_score'])
                except ValueError:
                    pass
            
            models_list.append({
                'model_name': row['model_name'],
                'price_per_token': float(row['price_per_token']),
                'provider': row['provider'],
                'mmlu_score': mmlu_score,
                'model_size': row['model_size']
            })
    
    return models_list


def get_llm_client(model: Dict) -> Optional[LLMClient]:
    """Get appropriate LLM client based on model provider"""
    provider = model['provider'].lower()
    model_name = model['model_name']
    
    if provider == 'openai' and secrets.get('openai', {}).get('api_key'):
        return OpenAIClient(secrets['openai']['api_key'], model_name)
    elif provider == 'anthropic' and secrets.get('anthropic', {}).get('api_key'):
        return AnthropicClient(secrets['anthropic']['api_key'], model_name)
    elif provider == 'google' and secrets.get('google', {}).get('api_key'):
        return GoogleClient(secrets['google']['api_key'], model_name)
    elif provider == 'mistral' and secrets.get('mistral', {}).get('api_key'):
        return MistralClient(secrets['mistral']['api_key'], model_name)
    
    return None


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': None
    })


@app.route('/api/models', methods=['GET'])
def get_models():
    """Get all models"""
    return jsonify({
        'success': True,
        'count': len(models),
        'data': models
    })


@app.route('/api/models/provider/<provider>', methods=['GET'])
def get_models_by_provider(provider: str):
    """Get models filtered by provider"""
    filtered = [m for m in models if m['provider'].lower() == provider.lower()]
    return jsonify({
        'success': True,
        'count': len(filtered),
        'provider': provider,
        'data': filtered
    })


@app.route('/api/providers', methods=['GET'])
def get_providers():
    """Get list of all providers"""
    providers = list(set(m['provider'] for m in models))
    providers.sort()
    return jsonify({
        'success': True,
        'count': len(providers),
        'data': providers
    })


@app.route('/api/get_best_price_for_prompt', methods=['POST'])
def get_best_price_for_prompt():
    """Calculate cost for a prompt across all models"""
    data = request.get_json()
    prompt = data.get('prompt', '').strip()
    
    if not prompt:
        return jsonify({
            'success': False,
            'error': 'Prompt is required and must be a non-empty string'
        }), 400
    
    # Estimate token count (roughly 1 token ≈ 4 characters)
    estimated_tokens = (len(prompt) + 3) // 4
    
    # Calculate cost for each model
    cost_results = []
    for model in models:
        total_cost = model['price_per_token'] * estimated_tokens
        cost_results.append({
            'model_name': model['model_name'],
            'provider': model['provider'],
            'price_per_token': model['price_per_token'],
            'estimated_tokens': estimated_tokens,
            'total_cost': total_cost,
            'mmlu_score': model['mmlu_score'],
            'model_size': model['model_size']
        })
    
    # Sort by total cost (cheapest first)
    cost_results.sort(key=lambda x: x['total_cost'])
    
    return jsonify({
        'success': True,
        'prompt': prompt,
        'estimated_tokens': estimated_tokens,
        'count': len(cost_results),
        'data': cost_results
    })


@app.route('/api/send_prompt', methods=['POST'])
def send_prompt_to_models():
    """Send prompt to actual LLM providers and return responses"""
    data = request.get_json()
    prompt = data.get('prompt', '').strip()
    model_names = data.get('model_names', [])
    providers = data.get('providers', [])
    
    if not prompt:
        return jsonify({
            'success': False,
            'error': 'Prompt is required'
        }), 400
    
    # Filter models based on request
    models_to_use = models
    if model_names:
        models_to_use = [m for m in models if m['model_name'] in model_names]
    elif providers:
        models_to_use = [m for m in models if m['provider'].lower() in [p.lower() for p in providers]]
    
    # Send prompt to each model
    responses = []
    for model in models_to_use:
        client = get_llm_client(model)
        if not client:
            responses.append({
                'model_name': model['model_name'],
                'provider': model['provider'],
                'success': False,
                'error': 'API key not configured for this provider'
            })
            continue
        
        try:
            response_text = client.send_prompt(prompt)
            responses.append({
                'model_name': model['model_name'],
                'provider': model['provider'],
                'success': True,
                'response': response_text
            })
        except Exception as e:
            responses.append({
                'model_name': model['model_name'],
                'provider': model['provider'],
                'success': False,
                'error': str(e)
            })
    
    return jsonify({
        'success': True,
        'count': len(responses),
        'data': responses
    })


if __name__ == '__main__':
    # Load secrets and models on startup
    secrets = load_secrets()
    models = load_models()
    
    port = int(os.environ.get('PORT', 3001))
    print(f"🚀 Python Backend server running on http://localhost:{port}")
    print(f"📊 Loaded {len(models)} models")
    print(f"🔑 Loaded secrets for {len(secrets)} providers")
    
    app.run(host='0.0.0.0', port=port, debug=True)

