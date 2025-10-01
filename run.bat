@echo off
IF NOT EXIST venv (
  python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt
set FLASK_APP=app.py
set FLASK_ENV=production
flask run --host=127.0.0.1 --port=5000
pause
