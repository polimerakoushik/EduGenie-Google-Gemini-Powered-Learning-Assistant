#!/usr/bin/env python3
"""Test script to verify Gemini API connectivity."""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv('GEMINI_API_KEY')

if not API_KEY:
    print("❌ GEMINI_API_KEY not found in .env")
    exit(1)

print(f"✓ API Key loaded: {API_KEY[:20]}...")

# Test models
models_to_test = [
    ('gemini-pro', 'v1/models/gemini-pro:generateContent'),
    ('gemini-1.5-pro-latest', 'v1/models/gemini-1.5-pro-latest:generateContent'),
    ('text-bison-001', 'v1beta2/models/text-bison-001:generateContent'),
    ('text-bison', 'v1beta2/models/text-bison:generateContent'),
    ('gemini-pro', 'v1beta/models/gemini-pro:generateContent'),
]

test_prompt = "Hello, respond with 'OK' if you can hear me."

for model_name, endpoint in models_to_test:
    print(f"\n🧪 Testing {model_name} at {endpoint}...")
    url = f"https://generativelanguage.googleapis.com/{endpoint}?key={API_KEY}"
    
    # Use generateContent format for all
    payload = {
        "contents": [{"parts": [{"text": test_prompt}]}],
        "generationConfig": {"maxOutputTokens": 100}
    }
    
    try:
        resp = requests.post(url, json=payload, timeout=10)
        print(f"   Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"   ✓ Success! Response: {str(data)[:100]}...")
            break
        else:
            print(f"   ✗ Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   ✗ Exception: {str(e)[:100]}")
