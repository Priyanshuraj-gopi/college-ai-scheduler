import os
import base64
import re

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from local_ai_worker import (
    process_email,
    privacy_firewall
)


# ============================================================
# CONFIGURATION
# ============================================================

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify"
]

CREDENTIALS_FILE = "credentials.json"
TOKEN_FILE = "gmail_modify_token.json"

READY_LABEL = "AI-GEMINI-READY"
LOCAL_PROCESSED_LABEL = "AI-LOCAL-PROCESSED"

# Maximum number of unprocessed Inbox emails examined per run
MAX_EMAILS_PER_RUN = 10


# ============================================================
# GMAIL AUTHENTICATION
# ============================================================

def get_gmail_service():

    credentials = None

    if os.path.exists(TOKEN_FILE):

        credentials = Credentials.from_authorized_user_file(
            TOKEN_FILE,
            SCOPES
        )

    if (
        credentials
        and credentials.expired
        and credentials.refresh_token
    ):

        credentials.refresh(Request())

    if not credentials or not credentials.valid:

        flow = InstalledAppFlow.from_client_secrets_file(
            CREDENTIALS_FILE,
            SCOPES
        )

        credentials = flow.run_local_server(
            port=0
        )

        with open(
            TOKEN_FILE,
            "w"
        ) as token_file:

            token_file.write(
                credentials.to_json()
            )

    return build(
        "gmail",
        "v1",
        credentials=credentials
    )


# ============================================================
# GMAIL LABEL HELPERS
# ============================================================

def find_label(
    service,
    label_name
):

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

        if label["name"] == label_name:

            return label["id"]

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

    label_id = created["id"]

    print(
        f"Label created: {label_id}"
    )

    return label_id


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
# GET UNPROCESSED INBOX EMAILS
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
# DECODE GMAIL BODY
# ============================================================

def decode_body(
    data
):

    if not data:

        return ""

    try:

        decoded = base64.urlsafe_b64decode(
            data.encode("UTF-8")
        )

        return decoded.decode(
            "UTF-8",
            errors="replace"
        )

    except Exception:

        return ""


# ============================================================
# RECURSIVE TEXT EXTRACTION
# ============================================================

def find_plain_text(
    part
):

    mime_type = part.get(
        "mimeType",
        ""
    )

    part_body = part.get(
        "body",
        {}
    )

    data = part_body.get(
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
# EXTRACT EMAIL
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
# BUILD LOCAL AI INPUT
# ============================================================

def build_email_text(
    email
):

    return f"""
EMAIL SUBJECT:
{email['subject']}

FROM:
{email['from']}

DATE:
{email['date']}

EMAIL BODY:
{email['body']}
""".strip()


# ============================================================
# FAST LOCAL PRE-FILTER
# ============================================================
#
# IMPORTANT:
#
# This runs AFTER the privacy firewall.
#
# Therefore sensitive emails are still handled by the
# privacy system before any deterministic filtering occurs.
#
# The purpose here is to avoid spending 1-3 minutes of Qwen
# processing time on emails that are obviously irrelevant.
# ============================================================

def fast_pre_filter(
    email
):

    subject = email[
        "subject"
    ].lower()

    sender = email[
        "from"
    ].lower()

    body = email[
        "body"
    ].lower()


    combined = (
        subject
        + "\n"
        + sender
        + "\n"
        + body[:6000]
    )


    # ========================================================
    # 1. DELIVERED PACKAGES
    # ========================================================

    delivered_patterns = [

        r"\border\b.*\bdelivered\b",
        r"\bpackage\b.*\bdelivered\b",
        r"\bshipment\b.*\bdelivered\b",
        r"\bdelivered\b.*\border\b",
        r"\bdelivered\b.*\bpackage\b",
        r"\bhas been delivered\b",
        r"\bwas delivered\b",
        r"\bsuccessfully delivered\b",
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
            "reason": (
                "Package/order already delivered."
            )
        }


    # ========================================================
    # 2. LINKEDIN ROUTINE NOTIFICATIONS
    # ========================================================

    if "linkedin.com" in sender:

        linkedin_irrelevant_patterns = [

            r"\byou have an invitation\b",
            r"\byou have a new invitation\b",
            r"\binvitation\b",
            r"\bpeople you may know\b",
            r"\bpeople you might know\b",
            r"\bnew connection\b",
            r"\bconnections\b",
            r"\bprofile views?\b",
            r"\bsomeone viewed your profile\b",
            r"\bjob alert\b",
            r"\bjob alerts\b",
            r"\bjobs you may be interested\b",
            r"\blooking for a new job\b",
            r"\brecommended jobs?\b",
            r"\bjobs for you\b",
        ]


        if any(
            re.search(
                pattern,
                subject,
                re.IGNORECASE
            )
            for pattern in linkedin_irrelevant_patterns
        ):

            return {
                "skip": True,
                "reason": (
                    "Routine LinkedIn notification/job alert."
                )
            }


    # ========================================================
    # 3. GENERIC NEWSLETTERS / MARKETING
    # ========================================================

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
        r"\bclearance sale\b",
    ]


    has_marketing_signal = any(
        re.search(
            pattern,
            combined,
            re.IGNORECASE
        )
        for pattern in marketing_patterns
    )


    # ========================================================
    # Strong actionable signals
    # ========================================================

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
        and
        not has_actionable_signal
    ):

        return {
            "skip": True,
            "reason": (
                "Newsletter/marketing email "
                "without a strong actionable signal."
            )
        }


    # ========================================================
    # 4. OBVIOUS SOCIAL / COMMUNITY NOTIFICATIONS
    # ========================================================

    routine_notification_patterns = [

        r"\byou have a new follower\b",
        r"\bnew follower\b",
        r"\bsomeone mentioned you\b",
        r"\bnew comment\b",
        r"\bnew like\b",
        r"\bnew reaction\b",
        r"\bactivity notification\b",
        r"\bsuggested for you\b",
        r"\brecommendation for you\b",
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
            "reason": (
                "Routine social/platform notification."
            )
        }


    # ========================================================
    # 5. OTHERWISE LET QWEN DECIDE
    # ========================================================

    return {
        "skip": False,
        "reason": (
            "Email requires local AI classification."
        )
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

    print(
        "\n================================"
    )

    print(
        "PROCESSING EMAIL"
    )

    print(
        "================================"
    )

    print(
        "Message ID:",
        message_id
    )


    # --------------------------------------------------------
    # Download full message
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
        len(
            email["body"]
        )
    )


    email_text = build_email_text(
        email
    )


    # ========================================================
    # PRIVACY FIREWALL FIRST
    # ========================================================

    privacy_result = privacy_firewall(
        email_text
    )


    print(
        "\nPRIVACY FIREWALL:"
    )

    print(
        privacy_result
    )


    if not privacy_result[
        "send_to_ai"
    ]:

        print(
            "\n================================"
        )

        print(
            "PRIVACY BLOCK"
        )

        print(
            "================================"
        )

        print(
            "Sensitive email will NOT reach Qwen."
        )

        print(
            "Sensitive email will NOT reach Gemini."
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


    # ========================================================
    # FAST PRE-FILTER
    # ========================================================

    prefilter_result = fast_pre_filter(
        email
    )


    print(
        "\n================================"
    )

    print(
        "FAST LOCAL PRE-FILTER"
    )

    print(
        "================================"
    )

    print(
        "Skip:",
        prefilter_result["skip"]
    )

    print(
        "Reason:",
        prefilter_result["reason"]
    )


    if prefilter_result[
        "skip"
    ]:

        print(
            "\nNo Qwen processing required."
        )

        print(
            "No Gemini processing required."
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


    # ========================================================
    # SEND TO QWEN
    # ========================================================

    print(
        "\nSending email to local AI..."
    )


    result = process_email(
        email_text
    )


    print(
        "\n================================"
    )

    print(
        "LOCAL AI RESULT"
    )

    print(
        "================================"
    )

    print(
        result
    )


    # ========================================================
    # TECHNICAL ERROR
    #
    # DO NOT MARK PROCESSED.
    # ========================================================

    if result.get(
        "status"
    ) == "error":

        print(
            "\n================================"
        )

        print(
            "TECHNICAL ERROR"
        )

        print(
            "================================"
        )

        print(
            "Email was NOT marked as processed."
        )

        print(
            "It will be retried on a future run."
        )

        return "error"


    # ========================================================
    # PRIVACY BLOCK FROM LOCAL AI
    # ========================================================

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


    # ========================================================
    # UNKNOWN STATUS
    # ========================================================

    if result.get(
        "status"
    ) != "processed":

        print(
            "\nUnknown processing status."
        )

        print(
            "Email was NOT marked as processed."
        )

        return "error"


    # ========================================================
    # FINAL QWEN RESULT
    # ========================================================

    ai_result = result.get(
        "ai",
        {}
    )


    relevant = ai_result.get(
        "relevant",
        False
    )


    # ========================================================
    # APPROVED
    # ========================================================

    if relevant is True:

        print(
            "\n================================"
        )

        print(
            "LOCAL AI APPROVED EMAIL"
        )

        print(
            "================================"
        )

        print(
            "Category:",
            ai_result.get(
                "category",
                ""
            )
        )

        print(
            "Title:",
            ai_result.get(
                "title",
                ""
            )
        )

        print(
            "Date:",
            ai_result.get(
                "date",
                ""
            )
        )


        # ----------------------------------------------------
        # Gemini-ready
        # ----------------------------------------------------

        add_label(
            service,
            message_id,
            ready_label_id
        )


        print(
            "AI-GEMINI-READY label added."
        )


        # ----------------------------------------------------
        # Local processed
        # ----------------------------------------------------

        add_label(
            service,
            message_id,
            local_processed_label_id
        )


        print(
            "AI-LOCAL-PROCESSED label added."
        )


        return "approved"


    # ========================================================
    # REJECTED BY QWEN
    # ========================================================

    print(
        "\n================================"
    )

    print(
        "LOCAL AI REJECTED EMAIL"
    )

    print(
        "================================"
    )

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

    print(
        "================================"
    )

    print(
        "COLLEGE AI INBOX AUTOMATION WORKER"
    )

    print(
        "================================"
    )


    service = get_gmail_service()


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
    # Inbox
    # --------------------------------------------------------

    print(
        "\nScanning NORMAL GMAIL INBOX..."
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
    # Process sequentially
    # --------------------------------------------------------

    for item in messages:

        message_id = item["id"]


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


            print(
                "\n================================"
            )

            print(
                "PROCESSING ERROR"
            )

            print(
                "================================"
            )

            print(
                "Message ID:",
                message_id
            )

            print(
                "Error:",
                str(error)
            )

            print(
                "Email was NOT marked as processed."
            )


    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    print(
        "\n================================"
    )

    print(
        "WORKER COMPLETE"
    )

    print(
        "================================"
    )

    print(
        "Approved for Gemini:",
        approved
    )

    print(
        "Rejected by Qwen:",
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

    print(
        "================================"
    )


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    main()