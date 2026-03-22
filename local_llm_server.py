#!/usr/bin/env python3
"""
Local LLM Server for VoiceForge
Uses Llama 3.1 8B Instruct for fast voice responses
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
import torch
import threading
import time

app = Flask(__name__)
CORS(app)

# Configuration
# Fast options for voice AI (pick one):
# MODEL_ID = "unsloth/Llama-3.2-3B-Instruct"      # ⚡ Fastest (3B params) - RECOMMENDED
MODEL_ID = "microsoft/Phi-3-mini-4k-instruct"   # ⚡ Fast + high quality (3.8B params)
# MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"         # ⚡ Fast, good for multilingual
# MODEL_ID = "TinyLlama/TinyLlama-1.1B-Chat-v1.1" # 🚀 Ultra fast (1.1B) - lowest quality

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"🚀 Loading model {MODEL_ID} on {DEVICE}...")
print("This may take 30-60 seconds...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
    device_map="auto" if DEVICE == "cuda" else None,
    low_cpu_mem_usage=True
)

if DEVICE == "cpu":
    model = model.to("cpu")

print(f"✅ Model loaded! Ready for voice calls.")

@app.route('/v1/chat/completions', methods=['POST'])
def chat_completions():
    """OpenAI-compatible endpoint for Vapi"""
    try:
        data = request.json
        messages = data.get('messages', [])
        temperature = data.get('temperature', 0.6)
        max_tokens = data.get('max_tokens', 150)  # Keep responses short for voice

        print(f"\n🎙️  Request received: {len(messages)} messages")
        start_time = time.time()

        # Format messages for Llama
        formatted_prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        # Tokenize
        inputs = tokenizer(formatted_prompt, return_tensors="pt").to(DEVICE)

        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )

        # Decode response
        response_text = tokenizer.decode(
            outputs[0][inputs['input_ids'].shape[1]:],
            skip_special_tokens=True
        ).strip()

        # Clean up response
        response_text = response_text.split('<|eot_id|>')[0].strip()

        elapsed = time.time() - start_time
        print(f"✅ Response generated in {elapsed:.2f}s: {response_text[:100]}...")

        return jsonify({
            "id": f"local-{int(time.time() * 1000)}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": MODEL_ID,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": inputs['input_ids'].shape[1],
                "completion_tokens": len(outputs[0]) - inputs['input_ids'].shape[1],
                "total_tokens": len(outputs[0])
            }
        })

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({
            "error": str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "model": MODEL_ID,
        "device": DEVICE
    })

if __name__ == '__main__':
    print(f"\n🌐 Starting server on http://localhost:8000")
    print(f"📡 Expose with: ngrok http 8000")
    app.run(host='0.0.0.0', port=8000, threaded=True)
