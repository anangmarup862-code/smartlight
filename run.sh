#!/usr/bin/env bash
VENV=".venv_lighting"
if [ ! -d "$VENV" ]; then
  python3 -m venv $VENV
  source $VENV/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
else
  source $VENV/bin/activate
fi
export FLASK_APP=app.py
python app.py