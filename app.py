import os
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# --- FEATURE: TOOL USE ---
def get_current_time(timezone: str = "UTC") -> str:
    """Returns the current time for a given timezone."""
    import datetime
    return f"The current time is {datetime.datetime.now().strftime('%H:%M:%S')}"

my_tools = [get_current_time]

chat_sessions = {}

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    chat_id = data.get('chatId')
    prompt = data.get('prompt')
    base64_image = data.get('image') 
    model_choice = data.get('model', 'auto')

    if not chat_id or (not prompt and not base64_image):
        return jsonify({"error": "Missing content"}), 400

    try:
        # --- FEATURE: AUTO ROUTING ---
        actual_model = model_choice
        if model_choice == "auto":
            # Logic: If coding/complex reasoning is needed, use Pro. Else, Flash.
            complex_keys = ["code", "analyze", "architect", "math", "reason"]
            if prompt and any(k in prompt.lower() for k in complex_keys):
                actual_model = "gemini-2.5-pro"
            else:
                actual_model = "gemini-2.5-flash"

        if chat_id not in chat_sessions:
            model = genai.GenerativeModel(
                model_name=actual_model,
                tools=my_tools,
                system_instruction="You are a helpful AI. You have perfect memory of this chat history. Use tools if needed."
            )
            chat_sessions[chat_id] = model.start_chat(enable_automatic_function_calling=True)
        
        chat_session = chat_sessions[chat_id]
        
        # Build multimodal message
        message_parts = []
        if prompt: message_parts.append(prompt)
        if base64_image:
            img_data = base64.b64decode(base64_image.split(",")[1])
            message_parts.append({"mime_type": "image/jpeg", "data": img_data})

        response = chat_session.send_message(message_parts)
        
        return jsonify({
            "text": response.text,
            "usedModel": actual_model # Tell frontend which one we used
        })
        
    except Exception as e:
        error_msg = str(e).lower()
        if "429" in error_msg or "quota" in error_msg:
            return jsonify({"error": "⚠️ **Quota Exceeded!** Please wait or switch models."}), 429
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)