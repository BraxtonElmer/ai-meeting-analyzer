from google import genai
from config import GEMINI_API_KEY


class MeetingChatbot:
    def __init__(self, caption_text: str, api_key: str, full_name: str):
        self.caption_text = caption_text
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.name=full_name

    # def summarize(self):
    #     prompt = f"Summarize the following meeting transcript:\n{self.caption_text}"
    #     return self.gemini_call(prompt)

    def summarize(self):
        prompt = f"Hi, my name is {self.name} reply with 'how may i assist you today'"
        return self.gemini_call(prompt)

    def ask_question(self, question: str):
        prompt = f"""You are an AI meeting assistant.
Based on the following meeting transcript, answer the user's question. my name is{self.name}.

Transcript:
{self.caption_text}

Question:
{question}

Answer:"""
        return self.gemini_call(prompt)

    def gemini_call(self, prompt: str):
        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash", contents=prompt
            )
            return response.text
        except Exception as e:
            return f"Error contacting Gemini: {str(e)}"
