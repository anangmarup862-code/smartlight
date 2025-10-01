from flask import Flask, render_template, send_from_directory # pyright: ignore[reportMissingImports]
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

# === ROUTES ===
@app.route("/")
def index():
    return render_template("index.html")

# Route untuk memastikan JSON bisa diakses
@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(app.static_folder, filename)

# Jalankan server
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)


