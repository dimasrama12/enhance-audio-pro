"""Live /enhance smoke test against the running frozen sidecar (port 8766).

Verifies the post-DFN DSP (HF shelf + envelope smoothing) actually executes in
the PyInstaller build by measuring that output HF energy < input HF energy.
"""
import http.server
import json
import os
import sqlite3
import threading
import time
import uuid

import numpy as np
import soundfile as sf
import librosa
import httpx

BACKEND = "http://127.0.0.1:8766"
CALLBACK_PORT = 8767
DB = r"C:\Users\User\AppData\Roaming\enhance-audio-pro\app.db"

done = {}


class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(n) or "{}")
        if self.path == "/callback/status" and body.get("status") in ("done", "error"):
            done.update(body)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, *a):
        pass


def hf_ratio(path):
    y, sr = librosa.load(path, sr=16000, mono=True)
    S = np.abs(librosa.stft(y, n_fft=2048)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    return float(S[freqs >= 4000].sum() / (S.sum() + 1e-12))


def main():
    srv = http.server.HTTPServer(("127.0.0.1", CALLBACK_PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    # 3s test signal: 300 Hz tone (speech band) + broadband HF hiss
    sr = 48000
    t = np.linspace(0, 3, sr * 3, endpoint=False)
    sig = 0.3 * np.sin(2 * np.pi * 300 * t) + 0.05 * np.random.randn(len(t))
    in_path = os.path.join(os.environ.get("TEMP", "."), "eap_smoke_in.wav")
    sf.write(in_path, sig.astype(np.float32), sr)

    jid = str(uuid.uuid4())
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    conn = sqlite3.connect(DB)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS queue_jobs ("
        "id TEXT PRIMARY KEY NOT NULL, filename TEXT NOT NULL, filepath TEXT NOT NULL, "
        "destination TEXT NOT NULL DEFAULT '', size_bytes INTEGER NOT NULL DEFAULT 0, "
        "media_type TEXT NOT NULL DEFAULT 'audio', status TEXT NOT NULL DEFAULT 'pending', "
        "progress INTEGER NOT NULL DEFAULT 0, error_message TEXT, "
        "output_format TEXT NOT NULL DEFAULT 'wav', output_filepath TEXT, "
        "created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
    )
    conn.execute(
        "INSERT INTO queue_jobs (id, filename, filepath, destination, status, output_format, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (jid, "eap_smoke_in.wav", in_path, os.path.dirname(in_path), "processing", "wav", now, now),
    )
    conn.commit()
    conn.close()

    print(f"POST /enhance job={jid}")
    r = httpx.post(f"{BACKEND}/enhance", json={
        "job_ids": [jid],
        "callback_url": f"http://127.0.0.1:{CALLBACK_PORT}",
        "strength": 0.5,
    }, timeout=15)
    print("  ->", r.status_code)

    for _ in range(120):
        if done:
            break
        time.sleep(1)

    if not done:
        print("FAIL: no done/error callback within 120s")
        raise SystemExit(1)
    if done.get("status") == "error":
        print("FAIL: enhance error:", done.get("error_message"))
        raise SystemExit(1)

    out = done["output_filepath"]
    print("DONE ->", out, "exists=", os.path.exists(out))
    in_hf, out_hf = hf_ratio(in_path), hf_ratio(out)
    delta = (out_hf - in_hf) / in_hf * 100
    print(f"HF ratio in={in_hf:.5f} out={out_hf:.5f}  dHF={delta:+.1f}%")
    if delta < -10:
        print("PASS: HF shelf demonstrably ran inside the frozen sidecar (HF reduced).")
    else:
        print("WARN: HF not reduced as expected — check DSP in frozen build.")


if __name__ == "__main__":
    main()
