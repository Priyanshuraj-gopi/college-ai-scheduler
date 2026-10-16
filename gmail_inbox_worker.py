import os
import sys
import shutil
import socket
import urllib.error
import base64
import re
import time

# Protect Windows console from UnicodeEncodeError (e.g. ₹ rupee symbol, emojis)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.exceptions import RefreshError, TransportError

from local_ai_worker import (
    process_email,
    privacy_firewall,
    unload_ollama_model
)


def throttle_process_priority():
    """
    Lowers the current process scheduling priority to BELOW_NORMAL so that
    Windows, browser tabs, and foreground typing always take CPU precedence.
    """
    if sys.platform.startswith("win"):
        try:
            import ctypes
            from ctypes import wintypes
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel32.GetCurrentProcess.restype = wintypes.HANDLE
            kernel32.SetPriorityClass.argtypes = [wintypes.HANDLE, wintypes.DWORD]
            kernel32.SetPriorityClass.restype = wintypes.BOOL
            # 0x00004000 = BELOW_NORMAL_PRIORITY_CLASS
            kernel32.SetPriorityClass(kernel32.GetCurrentProcess(), 0x00004000)
            print("[System] Windows CPU scheduling priority set to BELOW_NORMAL.")
        except Exception:
            pass


# ============================================================
# CONFIGURATION
# ============================================================

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify"
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CREDENTIALS_FILE = os.path.join(
    BASE_DIR,
    "credentials.json"
)

TOKEN_FILE = os.path.join(
    BASE_DIR,
    "gmail_modify_token.json"
)

TOKEN_BACKUP_FILE = os.path.join(
    BASE_DIR,
    "gmail_modify_token_backup.json"
)

READY_LABEL = "AI-GEMINI-READY"
LOCAL_PROCESSED_LABEL = "AI-LOCAL-PROCESSED"

# Maximum emails examined per execution
MAX_EMAILS_PER_RUN = 10

# Small delay between emails.
# Prevents rapid-fire requests and gives Ollama/Gmail time to settle.
DELAY_BETWEEN_EMAILS = 1.0

# Maximum email body characters passed toward local processing.
# Reduced to 2000 chars to avoid CPU-heavy prompt digestion phases.
MAX_BODY_CHARS_FOR_AI = 2000


# ============================================================
# GMAIL AUTHENTICATION & RESILIENT CREDENTIAL STORE
# ============================================================

def is_online(host="8.8.8.8", port=53, timeout=3.0):
    """
    Fast check to determine whether the machine currently has internet access.
    Prevents destructive operations when laptop lid opens before Wi-Fi associates.
    """
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        sock.close()
        return True
    except (socket.error, OSError):
        return False


def save_credentials(credentials):
    """
    Atomically writes credentials to TOKEN_FILE and mirrors to TOKEN_BACKUP_FILE.
    """
    temp_token = os.path.join(BASE_DIR, "gmail_modify_token.tmp")
    token_json = credentials.to_json()
    try:
        with open(temp_token, "w", encoding="utf-8") as f:
            f.write(token_json)
        os.replace(temp_token, TOKEN_FILE)
        with open(TOKEN_BACKUP_FILE, "w", encoding="utf-8") as f:
            f.write(token_json)
        print("[Auth] Credentials securely saved and backup mirrored.")
    except Exception as e:
        print(f"[Auth] Warning: Could not write token atomically ({e}). Writing directly...")
        with open(TOKEN_FILE, "w", encoding="utf-8") as f:
            f.write(token_json)


def load_stored_credentials():
    """
    Attempts to load credentials from TOKEN_FILE.
    If missing or corrupted, attempts recovery from TOKEN_BACKUP_FILE.
    """
    creds = None
    target_path = None

    if os.path.exists(TOKEN_FILE):
        target_path = TOKEN_FILE
    elif os.path.exists(TOKEN_BACKUP_FILE):
        print("[Auth] Primary token missing; recovering from backup...")
        target_path = TOKEN_BACKUP_FILE

    if target_path:
        try:
            creds = Credentials.from_authorized_user_file(target_path, SCOPES)
            if target_path == TOKEN_BACKUP_FILE:
                save_credentials(creds)
        except Exception as error:
            print(f"[Auth] Stored token at {os.path.basename(target_path)} could not be loaded: {error}")
            creds = None

    return creds


def get_gmail_service(allow_interactive_auth=False):
    """
    Retrieves or refreshes Gmail service without hanging the laptop or
    deleting credentials on transient network disconnects.
    """
    credentials = load_stored_credentials()

    # 1. Stored Token is Valid
    if credentials and credentials.valid:
        return build("gmail", "v1", credentials=credentials)

    # 2. Expired Token with Refresh Token
    if credentials and credentials.expired and credentials.refresh_token:
        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            if not is_online(timeout=2.0):
                print(f"[Auth] Network not yet ready (attempt {attempt}/{max_attempts}). Waiting 3s...")
                time.sleep(3.0)
                continue

            try:
                print(f"[Auth] Refreshing expired Gmail token silently (attempt {attempt})...")
                credentials.refresh(Request())
                save_credentials(credentials)
                print("[Auth] Gmail token refreshed successfully — no browser needed.")
                return build("gmail", "v1", credentials=credentials)

            except (TransportError, socket.gaierror, ConnectionError, TimeoutError, urllib.error.URLError) as net_err:
                print(f"[Auth] Network error during token refresh: {net_err}")
                if attempt < max_attempts:
                    time.sleep(3.0)
                else:
                    print("[Auth] Wi-Fi/Internet appears offline. Retaining existing token file for next run.")
                    return None

            except RefreshError as ref_err:
                err_str = str(ref_err).lower()
                print(f"[Auth] Google OAuth refresh rejected: {ref_err}")
                if "invalid_grant" in err_str:
                    print("[Auth] Refresh token was revoked or expired (Google Cloud OAuth Consent Screen in 'Testing' mode expires after 7 days).")
                    expired_backup = os.path.join(BASE_DIR, "gmail_modify_token_expired.json")
                    try:
                        if os.path.exists(TOKEN_FILE):
                            shutil.copy(TOKEN_FILE, expired_backup)
                    except Exception:
                        pass
                credentials = None
                break

            except Exception as general_err:
                print(f"[Auth] Unexpected error during refresh: {general_err}")
                return None

    # 3. No Valid Credentials Available
    if not allow_interactive_auth:
        print("\n" + "=" * 60)
        print("[ACTION REQUIRED] GMAIL AUTHENTICATION NEEDED")
        print("=" * 60)
        print("Interactive login is required to obtain a fresh offline token.")
        print("To prevent laptop freezing or browser popups during background tasks,")
        print("this runner WILL NOT open a browser automatically in background mode.")
        print("\nPlease run this command once in your terminal to log in:")
        print("    python gmail_inbox_worker.py --reauth")
        print("or run:")
        print("    run_college_ai.bat --reauth")
        print("=" * 60 + "\n")
        return None

    # 4. Interactive Browser OAuth Flow (explicitly requested)
    if not os.path.exists(CREDENTIALS_FILE):
        raise FileNotFoundError(
            f"credentials.json not found at:\n{CREDENTIALS_FILE}\n"
            "Download your OAuth Client ID json from Google Cloud Console."
        )

    print("\n================================")
    print("FRESH GMAIL OAUTH (Interactive)")
    print("================================")
    print("Opening browser for Google authorization...")

    flow = InstalledAppFlow.from_client_secrets_file(
        CREDENTIALS_FILE,
        SCOPES
    )

    credentials = flow.run_local_server(
        port=0,
        access_type="offline",
        prompt="consent"
    )

    save_credentials(credentials)
    print("[Auth] Fresh Gmail OAuth token saved with permanent offline refresh support.")

    return build("gmail", "v1", credentials=credentials)
def find_label(service,label_name ):

    results = (
        service.users()
        .labels()
        .list(
            userId="me"
        )
        .execute()
    )

    for label in results.get(
        "labels",
        []
    ):

        if label.get(
            "name"
        ) == label_name:

            return label.get(
                "id"
            )

    return None


def get_or_create_label(
    service,
    label_name
):

    existing_id = find_label(
        service,
        label_name
    )

    if existing_id:

        return existing_id

    print(
        f"\nCreating Gmail label: {label_name}"
    )

    created = (
        service.users()
        .labels()
        .create(
            userId="me",
            body={
                "name": label_name,
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show"
            }
        )
        .execute()
    )

    return created["id"]


def add_label(
    service,
    message_id,
    label_id
):

    (
        service.users()
        .messages()
        .modify(
            userId="me",
            id=message_id,
            body={
                "addLabelIds": [
                    label_id
                ]
            }
        )
        .execute()
    )


# ============================================================
# GET UNPROCESSED EMAILS
# ============================================================

def get_new_messages(
    service
):

    query = (
        "in:inbox "
        "-label:AI-LOCAL-PROCESSED "
        "-label:AI-GEMINI-READY"
    )

    results = (
        service.users()
        .messages()
        .list(
            userId="me",
            q=query,
            maxResults=MAX_EMAILS_PER_RUN
        )
        .execute()
    )

    return results.get(
        "messages",
        []
    )


# ============================================================
# BASE64 DECODER
# ============================================================

def decode_body(
    data
):

    if not data:
        return ""

    try:

        decoded = (
            base64.urlsafe_b64decode(
                data.encode("UTF-8")
            )
        )

        return decoded.decode(
            "UTF-8",
            errors="replace"
        )

    except Exception:

        return ""


# ============================================================
# TEXT EXTRACTION
# ============================================================

def find_plain_text(
    part
):

    mime_type = part.get(
        "mimeType",
        ""
    )

    body = part.get(
        "body",
        {}
    )

    data = body.get(
        "data"
    )

    if (
        mime_type == "text/plain"
        and data
    ):

        return decode_body(
            data
        )

    for child in part.get(
        "parts",
        []
    ):

        result = find_plain_text(
            child
        )

        if result:
            return result

    return ""


# ============================================================
# EMAIL EXTRACTION
# ============================================================

def extract_email(
    message
):

    payload = message.get(
        "payload",
        {}
    )

    headers = payload.get(
        "headers",
        []
    )

    subject = ""
    sender = ""
    date = ""

    for header in headers:

        name = header.get(
            "name",
            ""
        ).lower()

        value = header.get(
            "value",
            ""
        )

        if name == "subject":

            subject = value

        elif name == "from":

            sender = value

        elif name == "date":

            date = value

    body = find_plain_text(
        payload
    )

    # Fallback for simple messages
    if not body:

        data = (
            payload
            .get(
                "body",
                {}
            )
            .get(
                "data"
            )
        )

        if data:

            body = decode_body(
                data
            )

    return {
        "subject": subject,
        "from": sender,
        "date": date,
        "body": body
    }


# ============================================================
# LIMIT EMAIL SIZE BEFORE AI
# ============================================================

def compact_email_for_ai(
    email
):

    body = email.get(
        "body",
        ""
    )

    if len(body) > MAX_BODY_CHARS_FOR_AI:

        body = (
            body[
                :MAX_BODY_CHARS_FOR_AI
            ]
            + "\n\n[EMAIL BODY TRUNCATED]"
        )

    return {
        "subject": email.get(
            "subject",
            ""
        ),
        "from": email.get(
            "from",
            ""
        ),
        "date": email.get(
            "date",
            ""
        ),
        "body": body
    }


# ============================================================
# BUILD AI INPUT
# ============================================================

def build_email_text(
    email
):

    compact_email = compact_email_for_ai(
        email
    )

    return (
        "EMAIL SUBJECT:\n"
        + compact_email["subject"]
        + "\n\n"
        + "FROM:\n"
        + compact_email["from"]
        + "\n\n"
        + "DATE:\n"
        + compact_email["date"]
        + "\n\n"
        + "EMAIL BODY:\n"
        + compact_email["body"]
    )


# ============================================================
# FAST LOCAL PRE-FILTER
# ============================================================

def fast_pre_filter(
    email
):

    subject = email.get(
        "subject",
        ""
    ).lower()

    sender = email.get(
        "from",
        ""
    ).lower()

    body = email.get(
        "body",
        ""
    ).lower()

    combined = (
        subject
        + "\n"
        + sender
        + "\n"
        + body[:6000]
    )

    # --------------------------------------------------------
    # DELIVERED PACKAGES
    # --------------------------------------------------------

    delivered_patterns = [

        r"\border\b.*\bdelivered\b",
        r"\bpackage\b.*\bdelivered\b",
        r"\bshipment\b.*\bdelivered\b",
        r"\bdelivered\b.*\border\b",
        r"\bdelivered\b.*\bpackage\b",
        r"\bhas been delivered\b",
        r"\bwas delivered\b",
        r"\bsuccessfully delivered\b"

    ]

    if any(
        re.search(
            pattern,
            combined,
            re.IGNORECASE
        )
        for pattern in delivered_patterns
    ):

        return {
            "skip": True,
            "reason": "Package/order already delivered."
        }

    # --------------------------------------------------------
    # LINKEDIN ROUTINE EMAILS
    # --------------------------------------------------------

    if "linkedin.com" in sender:

        linkedin_patterns = [

            r"\binvitation\b",
            r"\bpeople you may know\b",
            r"\bpeople you might know\b",
            r"\bnew connection\b",
            r"\bprofile views?\b",
            r"\bsomeone viewed your profile\b",
            r"\bjob alert\b",
            r"\bjob alerts\b",
            r"\bjobs you may be interested\b",
            r"\brecommended jobs?\b",
            r"\bjobs for you\b"

        ]

        if any(
            re.search(
                pattern,
                subject,
                re.IGNORECASE
            )
            for pattern in linkedin_patterns
        ):

            return {
                "skip": True,
                "reason": "Routine LinkedIn notification/job alert."
            }

    # --------------------------------------------------------
    # MARKETING / NEWSLETTER
    # --------------------------------------------------------

    marketing_patterns = [

        r"\bunsubscribe\b",
        r"\bnewsletter\b",
        r"\bweekly roundup\b",
        r"\bmonthly roundup\b",
        r"\bdaily digest\b",
        r"\bmarketing\b",
        r"\bpromotional\b",
        r"\bpromotion\b",
        r"\bexclusive offer\b",
        r"\bspecial offer\b",
        r"\bshop now\b",
        r"\bbuy now\b",
        r"\bdiscount\b",
        r"\bcoupon\b",
        r"\bflash sale\b",
        r"\bclearance sale\b"

    ]

    has_marketing_signal = any(
        re.search(
            pattern,
            combined,
            re.IGNORECASE
        )
        for pattern in marketing_patterns
    )

    # --------------------------------------------------------
    # ACTIONABLE SIGNALS
    # --------------------------------------------------------

    actionable_patterns = [

        r"\bdue\b",
        r"\bdeadline\b",
        r"\bsubmit\b",
        r"\bsubmission\b",
        r"\bregister\b",
        r"\bregistration\b",
        r"\bapply\b",
        r"\bapplication\b",
        r"\bexam\b",
        r"\btest\b",
        r"\bassignment\b",
        r"\bclass\b",
        r"\blecture\b",
        r"\borientation\b",
        r"\bseminar\b",
        r"\bworkshop\b",
        r"\bmeeting\b",
        r"\bcompetition\b",
        r"\bappointment\b",
        r"\binterview\b",
        r"\btravel\b",
        r"\bflight\b",
        r"\bdeparture\b",
        r"\bdelivery\b",
        r"\bshipped\b",
        r"\bdispatched\b",
        r"\bexpected delivery\b",
        r"\bmandatory\b",
        r"\baction required\b",
        r"\bpayment due\b",
        r"\bpayment deadline\b",
        r"\bautomation test\b",
        r"\btest event\b"

    ]

    has_actionable_signal = any(
        re.search(
            pattern,
            combined,
            re.IGNORECASE
        )
        for pattern in actionable_patterns
    )

    if (
        has_marketing_signal
        and not has_actionable_signal
    ):

        return {
            "skip": True,
            "reason": (
                "Newsletter/marketing email "
                "without a strong actionable signal."
            )
        }

    # --------------------------------------------------------
    # ROUTINE SOCIAL NOTIFICATIONS
    # --------------------------------------------------------

    routine_notification_patterns = [

        r"\byou have a new follower\b",
        r"\bnew follower\b",
        r"\bsomeone mentioned you\b",
        r"\bnew comment\b",
        r"\bnew like\b",
        r"\bnew reaction\b",
        r"\bactivity notification\b",
        r"\bsuggested for you\b",
        r"\brecommendation for you\b"

    ]

    if any(
        re.search(
            pattern,
            subject,
            re.IGNORECASE
        )
        for pattern in routine_notification_patterns
    ):

        return {
            "skip": True,
            "reason": "Routine social/platform notification."
        }

    return {
        "skip": False,
        "reason": "Email requires local AI classification."
    }


# ============================================================
# PROCESS ONE EMAIL
# ============================================================

def process_one_email(
    service,
    message_id,
    ready_label_id,
    local_processed_label_id
):

    print("\n================================")
    print("PROCESSING EMAIL")
    print("================================")

    print(
        "Message ID:",
        message_id
    )

    # --------------------------------------------------------
    # Download email
    # --------------------------------------------------------

    message = (
        service.users()
        .messages()
        .get(
            userId="me",
            id=message_id,
            format="full"
        )
        .execute()
    )

    email = extract_email(
        message
    )

    print(
        "Subject:",
        email["subject"]
    )

    print(
        "From:",
        email["from"]
    )

    print(
        "Body characters:",
        len(email["body"])
    )

    # --------------------------------------------------------
    # Privacy firewall
    # --------------------------------------------------------

    email_text = build_email_text(
        email
    )

    privacy_result = privacy_firewall(
        email_text
    )

    print("\n================================")
    print("PRIVACY FIREWALL")
    print("================================")

    print(
        privacy_result
    )

    if not privacy_result["send_to_ai"]:

        print(
            "\nSENSITIVE EMAIL BLOCKED."
        )

        print(
            "Email will NOT reach Ollama."
        )

        print(
            "Email will NOT reach Gemini."
        )

        add_label(
            service,
            message_id,
            local_processed_label_id
        )

        print(
            "AI-LOCAL-PROCESSED label added."
        )

        return "blocked"

    # --------------------------------------------------------
    # Fast pre-filter
    # --------------------------------------------------------

    prefilter_result = fast_pre_filter(
        email
    )

    print("\n================================")
    print("FAST LOCAL PRE-FILTER")
    print("================================")

    print(
        "Skip:",
        prefilter_result["skip"]
    )

    print(
        "Reason:",
        prefilter_result["reason"]
    )

    if prefilter_result["skip"]:

        print(
            "\nNo Ollama processing required."
        )

        add_label(
            service,
            message_id,
            local_processed_label_id
        )

        print(
            "AI-LOCAL-PROCESSED label added."
        )

        return "prefiltered"

    # --------------------------------------------------------
    # CPU AI PROCESSING
    # --------------------------------------------------------

    print("\n================================")
    print("LOCAL OLLAMA PROCESSING")
    print("================================")

    print(
        "Processing ONE email at a time."
    )

    print(
        "No parallel AI requests."
    )

    print(
        "Sending compact email to Ollama..."
    )

    start_time = time.time()

    try:

        result = process_email(
            email_text
        )

    except Exception as error:

        print(
            "\nOLLAMA WORKER EXCEPTION:"
        )

        print(
            str(error)
        )

        print(
            "\nEmail will remain unprocessed."
        )

        return "error"

    elapsed = time.time() - start_time

    print(
        f"\nOllama processing time: {elapsed:.2f} seconds"
    )

    print("\n================================")
    print("LOCAL AI RESULT")
    print("================================")

    print(
        result
    )

    # --------------------------------------------------------
    # Technical error
    # --------------------------------------------------------

    if result.get(
        "status"
    ) == "error":

        print(
            "\nTECHNICAL ERROR."
        )

        print(
            "Email NOT marked processed."
        )

        print(
            "It will be retried on the next run."
        )

        return "error"

    # --------------------------------------------------------
    # Privacy block from local AI
    # --------------------------------------------------------

    if result.get(
        "status"
    ) == "blocked":

        add_label(
            service,
            message_id,
            local_processed_label_id
        )

        print(
            "AI-LOCAL-PROCESSED label added."
        )

        return "blocked"

    # --------------------------------------------------------
    # Unexpected status
    # --------------------------------------------------------

    if result.get(
        "status"
    ) != "processed":

        print(
            "\nUNKNOWN LOCAL AI STATUS."
        )

        print(
            "Email NOT marked processed."
        )

        return "error"

    # --------------------------------------------------------
    # AI classification
    # --------------------------------------------------------

    ai_result = result.get(
        "ai",
        {}
    )

    relevant = ai_result.get(
        "relevant",
        False
    )

    print(
        "\nRelevant:",
        relevant
    )

    print(
        "Category:",
        ai_result.get(
            "category",
            ""
        )
    )

    print(
        "Priority:",
        ai_result.get(
            "priority",
            ""
        )
    )

    # --------------------------------------------------------
    # Relevant → Gemini queue
    # --------------------------------------------------------

    if relevant is True:

        print("\n================================")
        print("LOCAL AI APPROVED EMAIL")
        print("================================")

        print(
            "Email is eligible for Gemini."
        )

        add_label(
            service,
            message_id,
            ready_label_id
        )

        print(
            "AI-GEMINI-READY label added."
        )

        add_label(
            service,
            message_id,
            local_processed_label_id
        )

        print(
            "AI-LOCAL-PROCESSED label added."
        )

        return "approved"

    # --------------------------------------------------------
    # Irrelevant → finish
    # --------------------------------------------------------

    print("\n================================")
    print("LOCAL AI REJECTED EMAIL")
    print("================================")

    print(
        "No Gemini processing will occur."
    )

    add_label(
        service,
        message_id,
        local_processed_label_id
    )

    print(
        "AI-LOCAL-PROCESSED label added."
    )

    return "rejected"


# ============================================================
# MAIN
# ============================================================

def main():

    # Throttle process priority so Windows UI, browsers, and user tasks stay smooth
    throttle_process_priority()

    print("================================")
    print("COLLEGE AI INBOX AUTOMATION")
    print("CPU-OPTIMIZED SEQUENTIAL MODE")
    print("================================")

    print(
        "Script directory:",
        BASE_DIR
    )

    print(
        "Maximum emails per run:",
        MAX_EMAILS_PER_RUN
    )

    print(
        "Delay between emails:",
        DELAY_BETWEEN_EMAILS,
        "seconds"
    )

    print(
        "Maximum AI body:",
        MAX_BODY_CHARS_FOR_AI,
        "characters"
    )

    # --------------------------------------------------------
    # Gmail connection
    # --------------------------------------------------------

    reauth_flag = any(arg in sys.argv[1:] for arg in ["--reauth", "--auth", "-r", "login"])

    service = get_gmail_service(allow_interactive_auth=reauth_flag)

    if not service:
        if not reauth_flag:
            print("\n[Worker] Background execution halted cleanly — no valid Gmail service.")
        return

    if reauth_flag and len(sys.argv) == 2:
        print("\n================================")
        print("RE-AUTHENTICATION SUCCESSFUL!")
        print("================================")
        print("Offline token saved and verified.")
        print("The background worker will now run without prompting.")
        print("================================")
        return

    # --------------------------------------------------------
    # Labels
    # --------------------------------------------------------

    ready_label_id = get_or_create_label(
        service,
        READY_LABEL
    )

    print(
        "\nGemini-ready label:",
        ready_label_id
    )

    local_processed_label_id = (
        get_or_create_label(
            service,
            LOCAL_PROCESSED_LABEL
        )
    )

    print(
        "Local processed label:",
        local_processed_label_id
    )

    # --------------------------------------------------------
    # Find emails
    # --------------------------------------------------------

    print(
        "\nScanning Gmail INBOX..."
    )

    messages = get_new_messages(
        service
    )

    print(
        "\nNew Inbox emails found:",
        len(messages)
    )

    if not messages:

        print(
            "\nNothing new to process."
        )

        print(
            "Worker finished."
        )

        unload_ollama_model()

        return

    # --------------------------------------------------------
    # Counters
    # --------------------------------------------------------

    approved = 0
    rejected = 0
    prefiltered = 0
    blocked = 0
    errors = 0

    # --------------------------------------------------------
    # STRICT SEQUENTIAL PROCESSING
    # --------------------------------------------------------

    for index, item in enumerate(
        messages,
        start=1
    ):

        message_id = item["id"]

        print("\n")
        print(
            "########################################"
        )

        print(
            f"EMAIL {index} OF {len(messages)}"
        )

        print(
            "########################################"
        )

        try:

            result = process_one_email(
                service,
                message_id,
                ready_label_id,
                local_processed_label_id
            )

            if result == "approved":

                approved += 1

            elif result == "rejected":

                rejected += 1

            elif result == "prefiltered":

                prefiltered += 1

            elif result == "blocked":

                blocked += 1

            elif result == "error":

                errors += 1

        except Exception as error:

            errors += 1

            print("\n================================")
            print("UNHANDLED EMAIL ERROR")
            print("================================")

            print(
                "Message ID:",
                message_id
            )

            print(
                "Error:",
                str(error)
            )

            print(
                "Email was NOT marked processed."
            )

        # ----------------------------------------------------
        # IMPORTANT:
        # Never fire multiple Ollama requests together.
        # ----------------------------------------------------

        if index < len(messages):

            print(
                f"\nWaiting {DELAY_BETWEEN_EMAILS:.1f}s "
                "before next email..."
            )

            time.sleep(
                DELAY_BETWEEN_EMAILS
            )

    # --------------------------------------------------------
    # Final report
    # --------------------------------------------------------

    print("\n================================")
    print("WORKER COMPLETE")
    print("================================")

    print(
        "Emails examined:",
        len(messages)
    )

    print(
        "Approved for Gemini:",
        approved
    )

    print(
        "Rejected by Ollama:",
        rejected
    )

    print(
        "Rejected by fast filter:",
        prefiltered
    )

    print(
        "Blocked by privacy firewall:",
        blocked
    )

    print(
        "Technical errors:",
        errors
    )

    print("================================")
    unload_ollama_model()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()