# College AI Scheduler

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Local_Edge_AI-000000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.ai/)
[![Qwen](https://img.shields.io/badge/Model-Qwen_3:4B-FF6A00?style=for-the-badge)](https://huggingface.co/Qwen)
[![Gemini](https://img.shields.io/badge/Cloud_AI-Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Apps Script](https://img.shields.io/badge/Runtime-Google_Apps_Script-34A853?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/apps-script)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <b>A privacy-first, hybrid edge/cloud autonomous academic copilot.</b><br>
  Triage campus emails locally with lightweight CPU-throttled models, filter sensitive personal data on-device, and orchestrate calendar events & tasks in the cloud via Gemini.
</p>

</div>

---

## 🏛️ System Architecture

College inboxes receive hundreds of automated emails every week—ranging from critical exam deadlines and timetable shifts to unread newsletters and login OTPs. 

**College AI Scheduler** separates concerns through a dual-tier architecture: **deterministic, privacy-guaranteed edge triage** on your local machine, paired with **high-reasoning cloud orchestration** via Google Cloud and Apps Script.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. LOCAL RUNNER (Laptop / Edge Worker)                                                 │
│                                                                                        │
│  [ Gmail Inbox ]                                                                       │
│         │                                                                              │
│         ▼                                                                              │
│  [ Resilient OAuth Store ] ──── (Offline refresh + Wi-Fi wake-from-sleep guard)        │
│         │                                                                              │
│         ▼                                                                              │
│  [ Privacy Firewall ]      ──── Blocks OTPs, passwords, 2FA, PINs on-device            │
│         │                                                                              │
│         ▼                                                                              │
│  [ Fast Local Heuristics ] ──── Instantly discards obvious marketing/newsletters       │
│         │                                                                              │
│         ▼                                                                              │
│  [ Ollama (Qwen 3:4B) ]    ──── 3-Thread CPU ceiling, 1024 context, low priority       │
│         │                                                                              │
│         ├── Irrelevant   ───► Tag: AI-LOCAL-PROCESSED                                  │
│         └── Actionable   ───► Tag: AI-GEMINI-READY                                     │
│         │                                                                              │
│         ▼                                                                              │
│  [ Immediate RAM Eviction] ─── Drops model from memory back to 0 MB (keep_alive: 0)    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. CLOUD ORCHESTRATION (Google Apps Script Engine)                                     │
│                                                                                        │
│  [ 30-Minute Trigger ] ────── Polls for emails with 'AI-GEMINI-READY' label            │
│         │                                                                              │
│         ▼                                                                              │
│  [ Gemini 1.5 Pro / Flash ] ─ Extracts dates, venue, prerequisites, assignment tasks    │
│         │                                                                              │
│         ├── Academic Event ──► Google Calendar (with notification alerts)              │
│         └── Assignment/Task ─► Google Tasks (with due dates & notes)                   │
│                                                                                        │
│  [ Registro ERP Sync ] ────── Synchronizes live college timetable & map sessions       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Highlights

### 🛡️ Privacy Firewall (On-Device)
Emails containing authentication codes, one-time passwords (OTPs), financial pins, or recovery credentials are automatically intercepted and quarantined on-device before any AI sees them. Sensitive emails are never sent to Ollama or Gemini.

### 🔋 CPU & RAM Capacity Throttling
Engineered specifically for personal laptops so your computer never freezes:
- **Thread Ceiling**: Caps Ollama to at most 3 CPU threads, ensuring the remaining CPU cores (~75%) stay completely free.
- **Process Priority**: Runs at `BELOW_NORMAL_PRIORITY_CLASS`, ensuring browser tabs, typing, and video playback always take priority.
- **Reduced Context Footprint**: `num_ctx: 1024` halves internal KV Cache RAM allocation.
- **Zero Idle RAM**: Calls `unload_ollama_model()` the moment the batch completes, immediately releasing ~2.7 GB of memory back to the operating system.

### 🔄 Resilient Offline Authentication
- Recovers gracefully from laptop wake-from-sleep states when Wi-Fi is temporarily disconnected.
- Never destroys stored tokens on network timeouts.
- Background scheduled tasks execute unattended with zero invasive browser pop-ups.

---

## 📂 Repository Structure

```bash
college-ai-scheduler/
├── Code.js                     # Google Apps Script cloud engine (Gemini & Registro sync)
├── appsscript.json             # Manifest for Apps Script project
├── gmail_inbox_worker.py       # Main background worker (OAuth, Gmail API, batch scanner)
├── local_ai_worker.py          # Local edge AI engine (Privacy firewall, Ollama client, capacity limiter)
├── run_college_ai.bat          # Windows batch runner for Task Scheduler
├── credentials.example.json    # Template for Google Cloud OAuth Client ID
└── .gitignore                  # Strict secret shielding (tokens, logs, credentials)
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python 3.10+**
- **[Ollama](https://ollama.ai/)** running locally
- Pull the lightweight classification model:
  ```bash
  ollama pull qwen3:4b
  ```

### 2. Installation
Clone the repository and install required dependencies:
```bash
git clone https://github.com/Priyanshuraj-gopi/college-ai-scheduler.git
cd college-ai-scheduler
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

### 3. Google Cloud Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Gmail API**.
3. Create an **OAuth 2.0 Client ID** (Desktop Application).
4. Download the JSON and save it in the project root as `credentials.json` (see `credentials.example.json` for structure).
5. In your OAuth Consent Screen, set Publishing Status to **In Production** so your personal refresh token never expires.

### 4. Authenticate Once
Run the worker with the `--reauth` flag to authorize your Gmail access:
```bash
python gmail_inbox_worker.py --reauth
```
A browser window will open. Authorize your personal account once. The token will be saved securely to `gmail_modify_token.json` and mirrored to `gmail_modify_token_backup.json`.

### 5. Running the Worker
- **Manual on-demand run**:
  ```bash
  run_college_ai.bat
  ```
- **Automated background scheduling (Windows)**:
  1. Open **Task Scheduler** (`taskschd.msc`).
  2. Create a basic task named `College AI Automation`.
  3. Set trigger to **Every 30 minutes**.
  4. Set action to start `run_college_ai.bat`.

---

## ☁️ Google Apps Script (Cloud Layer)

The cloud layer (`Code.js`) runs directly inside Google's cloud infrastructure via Apps Script:
1. Cloned and deployed via `@google/clasp`.
2. Automatically synchronizes timetable sessions from your college student portal (Registro) to Google Calendar with duplicate session collision protection.
3. Automatically queries all emails labeled `AI-GEMINI-READY`, feeds them to Gemini, creates calendar events/tasks, and updates labels to `AI-PROCESSED`.

---

## 🔒 Security Best Practices

- **Zero Credentials in Git**: All tokens (`*token*.json`), client secrets (`credentials.json`), clasp configs, and local logs are protected by `.gitignore`.
- **Minimal Scopes**: Uses `https://www.googleapis.com/auth/gmail.modify` only to read headers and apply workflow labels (`AI-GEMINI-READY`, `AI-LOCAL-PROCESSED`).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
