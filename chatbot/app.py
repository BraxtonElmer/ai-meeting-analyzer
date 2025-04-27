from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from chatbot import MeetingChatbot
import markdown
from markupsafe import Markup
from config import GEMINI_API_KEY
import database

app = Flask(__name__)
app.secret_key = 'tung tung tung tung tung tung tung sahur'

with open('uploads/meeting_captions.txt', 'r', encoding='utf-8') as f:
    transcript_text = f.read()

def format_markdown(text):
    return Markup(markdown.markdown(text))

# Initialize database
database.init_db()

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        full_name = request.form.get('full_name')
        email = request.form.get('email')
        password = request.form.get('password')
        re_password = request.form.get('re_password')

        if not full_name or not email or not password or not re_password:
            flash('Please fill in all fields.')
            return redirect(url_for('register'))
        

        existing_user = database.get_user_by_email(email)
        if existing_user:
            flash('Email already exists.')
            return redirect(url_for('register'))
        

        if password != re_password:
            flash('Passwords do not match!')
            return redirect(url_for('register'))
        
        
        success = database.create_user(full_name, email, password)
        if success:
            flash('Registration successful! Please log in.')
            return redirect(url_for('login'))
        else:
            flash('An unexpected error occurred. Please try again.')
            return redirect(url_for('register'))
    
    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        if not email or not password:
            flash('Please enter both email and password.')
            return redirect(url_for('login'))

        user = database.get_user(email, password)
        if user:
            session['user_id'] = user['id']
            session['email'] = user['email']
            session['full_name'] = user['full_name']
            return redirect(url_for('index'))
        else:
            flash('Invalid email or password. Please try again.')
            return redirect(url_for('login'))

    return render_template('login.html')



@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/', methods=['GET'])
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    chats = database.get_chats(session['user_id'])

    chatbot = MeetingChatbot(transcript_text, GEMINI_API_KEY, full_name=session['full_name'])
    summary = chatbot.summarize()

    return render_template('index.html', summary=summary, chats=chats, full_name=session['full_name'])


@app.route('/ask', methods=['POST'])
def ask():
    if 'user_id' not in session:
        return jsonify({'answer': 'Unauthorized'})

    question = request.form['question']

    chatbot = MeetingChatbot(transcript_text, GEMINI_API_KEY, session['full_name'])

    answer = chatbot.ask_question(question)

    formatted_answer = format_markdown(answer)

    database.save_chat(session['user_id'], question, 'user')
    database.save_chat(session['user_id'], answer, 'bot')

    return jsonify({'answer': str(formatted_answer)})




if __name__ == '__main__':
    app.run(debug=True)
