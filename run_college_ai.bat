@echo off
cd /d "%~dp0"

echo ========================================
echo COLLEGE AI AUTOMATION WORKER
echo ========================================
echo.

set PYTHONIOENCODING=utf-8:replace
python gmail_inbox_worker.py %*

echo.
echo ========================================
echo WORKER FINISHED
echo ========================================