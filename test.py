import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

print("Models available for chat/text generation:")
print("-" * 40)

# Loop through all models and print the ones that support content generation
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)