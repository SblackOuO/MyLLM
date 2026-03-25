import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app) # Allow frontend to communicate with backend

# Initialize Gemini
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")

# Store chat sessions in memory
chat_sessions = {}

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    chat_id = data.get('chatId')
    prompt = data.get('prompt')

    if not chat_id or not prompt:
        return jsonify({"error": "Missing chatId or prompt"}), 400

    try:
        if chat_id not in chat_sessions:
            chat_sessions[chat_id] = model.start_chat(history=[])
        
        chat_session = chat_sessions[chat_id]
        response = chat_session.send_message(prompt)
        
        return jsonify({"text": response.text})
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return jsonify({"error": "Failed to fetch response from Gemini."}), 500

if __name__ == '__main__':
    print("Starting server on http://localhost:5000...")
    app.run(debug=True, port=5000)