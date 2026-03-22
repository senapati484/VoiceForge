#!/bin/bash
# Run local LLM server for VoiceForge

cd /Users/sayansenapati/Desktop/Dev/Hackathon/BinaryV2

echo "=== VoiceForge Local LLM Server ==="
echo ""

# Check if virtual environment exists
if [ ! -d "venv-llm" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv-llm
fi

# Activate
source venv-llm/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements-llm.txt

echo ""
echo "🚀 Starting Local LLM Server..."
echo ""
echo "This will:"
echo "1. Download Llama 3.1 8B Instruct (~16GB) - first time only"
echo "2. Start server on http://localhost:8000"
echo "3. You'll need to run 'ngrok http 8000' in another terminal"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

python3 local_llm_server.py
