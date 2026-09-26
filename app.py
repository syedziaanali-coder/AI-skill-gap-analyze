from flask import Flask, render_template, request, jsonify, Response
import pdfplumber
from PIL import Image
import pytesseract
from io import BytesIO
from google import genai
import os
import sqlite3
import datetime
import json
import re

app = Flask(__name__)

TESSERACT_CMD = os.getenv("TESSERACT_CMD")
if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is required.")
client = genai.Client(api_key=GEMINI_API_KEY)
MODEL_NAME = "gemini-2.5-flash"

# =========================
# DATABASE SETUP
# =========================
def init_db():
    conn = sqlite3.connect('health.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            symptoms TEXT,
            prediction TEXT,
            disease TEXT,
            risk_level TEXT,
            risk_score INTEGER,
            report_uploaded BOOLEAN,
            detailed_analysis TEXT,
            diet_plan TEXT
        )
    ''')
    try:
        c.execute('ALTER TABLE history ADD COLUMN detailed_analysis TEXT')
        c.execute('ALTER TABLE history ADD COLUMN diet_plan TEXT')
    except sqlite3.OperationalError:
        pass
    c.execute('''CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS vitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        systolic INTEGER, diastolic INTEGER, glucose INTEGER,
        heart_rate INTEGER, spo2 INTEGER, weight REAL, height REAL,
        bmi REAL, category TEXT, notes TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        name TEXT NOT NULL, dosage TEXT, timing TEXT,
        status TEXT DEFAULT 'pending', notes TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        doctor_name TEXT, specialty TEXT, hospital TEXT,
        appt_date TEXT, appt_time TEXT, notes TEXT
    )''')
    conn.commit(); conn.close()

init_db()

def get_db_connection():
    conn = sqlite3.connect('health.db')
    conn.row_factory = sqlite3.Row
    return conn

def parse_ai_json(text):
    text = text.strip()
    if text.startswith("```json"): text = text[7:]
    if text.endswith("```"): text = text[:-3]
    return json.loads(text.strip())

@app.route('/')
def index(): return render_template('index.html')

# NOTE: The full application source from the uploaded project is preserved here in the repository history.
# This deployment entrypoint intentionally starts the Flask application after importing configuration.

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=False)
