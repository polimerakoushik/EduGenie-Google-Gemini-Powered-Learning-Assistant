"""Gemini (Generative Language) API helper.

This module calls Google's Generative Language API with advanced prompting
for educational responses. Expects:
- GEMINI_API_KEY
- GEMINI_MODEL (e.g., text-bison-001)
"""
import os
import requests
from typing import Any, Dict, List

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'text-bison-001')


def _extract_text_from_response(data: Dict[str, Any]) -> str:
    """Extract text from various Gemini response formats."""
    if not isinstance(data, dict):
        return str(data)

    # Newer generateContent format: {"candidates": [{"content": {"parts": [{"text": "..."}]}}]}
    cands = data.get('candidates')
    if isinstance(cands, list) and cands:
        first = cands[0]
        if isinstance(first, dict):
            # Try new format first
            if 'content' in first:
                content = first.get('content')
                if isinstance(content, dict):
                    parts = content.get('parts', [])
                    if isinstance(parts, list):
                        text_parts = []
                        for p in parts:
                            if isinstance(p, dict) and 'text' in p:
                                text_parts.append(p['text'])
                        if text_parts:
                            return ''.join(text_parts).strip()
            
            # Try old format
            if 'output' in first:
                return first.get('output', '').strip()

    # Old v1beta2 format: {"candidates": [{"output": "..."}]}
    if isinstance(cands, list) and cands:
        first = cands[0]
        if isinstance(first, dict) and 'output' in first:
            return first.get('output', '').strip()

    if 'output' in data:
        return data.get('output', '').strip()

    return str(data).strip()


def build_educational_prompt(user_question: str, conversation_history: List[Dict[str, str]] = None) -> str:
    """Build a sophisticated prompt for educational Q&A."""
    history_text = ""
    if conversation_history:
        history_text = "\n## Previous Conversation:\n"
        for msg in conversation_history[-4:]:  # Keep last 4 exchanges for context
            role = msg.get('role', 'User')
            content = msg.get('content', '')
            history_text += f"{role}: {content}\n"

    system_prompt = (
        "You are EduGenie, an expert educational learning assistant. "
        "Your role is to help students understand complex topics by:\n"
        "1. Providing clear, concise explanations\n"
        "2. Breaking down concepts into simple steps\n"
        "3. Using real-world examples and analogies\n"
        "4. Encouraging critical thinking\n"
        "5. Suggesting resources and next steps for deeper learning\n\n"
        "Keep responses friendly, engaging, and focused on learning.\n"
        "Use markdown formatting for clarity (bold for key terms, numbered lists for steps).\n"
    )

    full_prompt = (
        f"{system_prompt}"
        f"{history_text}"
        f"\n## Student Question:\n{user_question}\n\n"
        f"Provide a comprehensive but concise response that educates and inspires."
    )
    return full_prompt


def query_gemini(
    prompt: str,
    temperature: float = 0.7,
    max_output_tokens: int = 1024,
    conversation_history: List[Dict[str, str]] = None
) -> Dict[str, str]:
    """Query Gemini and return educational response.
    
    Args:
        prompt: User question
        temperature: Model creativity (0.0-1.0)
        max_output_tokens: Max response length
        conversation_history: Previous messages for context
        
    Returns:
        Dict with 'response' key containing the reply
    """
    if not GEMINI_API_KEY:
        return {
            "response": (
                "⚠️ **API Configuration Issue**\n\n"
                "The Gemini API key is not configured. Please:\n\n"
                "1. Update your `.env` file with a valid GEMINI_API_KEY\n"
                "2. Get your key from: https://makersuite.google.com/app/apikey\n"
                "3. Restart the Flask app\n\n"
                "Until then, I'm running in demo mode."
            )
        }

    # Build sophisticated prompt
    full_prompt = build_educational_prompt(prompt, conversation_history)

    # Try multiple Gemini endpoints
    endpoints = [
        {
            'name': 'gemini-pro',
            'url': f"https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={GEMINI_API_KEY}",
            'payload_format': 'new'
        },
        {
            'name': 'text-bison',
            'url': f"https://generativelanguage.googleapis.com/v1beta2/models/text-bison:generateContent?key={GEMINI_API_KEY}",
            'payload_format': 'new'
        },
        {
            'name': 'text-bison-001',
            'url': f"https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateContent?key={GEMINI_API_KEY}",
            'payload_format': 'new'
        },
    ]
    
    for endpoint in endpoints:
        try:
            if endpoint['payload_format'] == 'new':
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": full_prompt}
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": max_output_tokens,
                        "topP": 0.95,
                        "topK": 40,
                    }
                }
            else:
                payload = {
                    "prompt": {"text": full_prompt},
                    "temperature": temperature,
                    "maxOutputTokens": max_output_tokens,
                }

            res = requests.post(endpoint['url'], json=payload, timeout=30)
            
            # If successful, extract and return
            if res.status_code == 200:
                data = res.json()
                text = _extract_text_from_response(data)
                return {"response": text if text else "I couldn't generate a response. Please try again."}
            
            # Log but continue to next endpoint on error
            print(f"[API] {endpoint['name']}: {res.status_code}")
            
        except requests.exceptions.Timeout:
            print(f"[API] {endpoint['name']}: Timeout")
            continue
        except requests.exceptions.HTTPError as e:
            print(f"[API] {endpoint['name']}: HTTP {e.response.status_code}")
            continue
        except Exception as e:
            print(f"[API] {endpoint['name']}: {str(e)[:50]}")
            continue
    
    # All endpoints failed - return helpful error
    return {
        "response": (
            "❌ **Unable to connect to Gemini API**\n\n"
            "The API key may be invalid or the models are not available.\n\n"
            "**To fix this:**\n"
            "1. Visit: https://makersuite.google.com/app/apikey\n"
            "2. Create or copy a valid API key\n"
            "3. Update `.env`: `GEMINI_API_KEY=your_key_here`\n"
            "4. Restart the app\n\n"
            "**For now**, I'm running in limited mode. Try asking again after updating your API key."
        )
    }
