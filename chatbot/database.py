import mysql.connector
from config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME

def get_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            message TEXT,
            sender VARCHAR(10),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    conn.commit()
    conn.close()

def create_user(full_name, email, password):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO users (full_name, email, password) VALUES (%s, %s, %s)', (full_name, email, password))
        conn.commit()
    except mysql.connector.IntegrityError:
        return False
    finally:
        conn.close()
    return True

def get_user(email, password):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT id, email, full_name FROM users WHERE email = %s AND password = %s', (email, password))
    user = cursor.fetchone()
    conn.close()
    return user

def get_user_by_email(email):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT id, email, full_name FROM users WHERE email = %s', (email,))
    user = cursor.fetchone()
    conn.close()
    return user


def save_chat(user_id, message, sender):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO chats (user_id, message, sender) VALUES (%s, %s, %s)', (user_id, message, sender))
    conn.commit()
    conn.close()

def get_chats(user_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT sender, message FROM chats WHERE user_id = %s', (user_id,))
    chats = cursor.fetchall()
    conn.close()
    return chats
