import os
import base64
from email import message_from_bytes

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build


# ============================================================
# CONFIGURATION
# ============================================================

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly"
]

CREDENTIALS_FILE = "credentials.json"
TOKEN_FILE = "gmail_token.json"

TARGET_LABEL = "AI-AUTOMATION-INBOX"


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

    if credentials and credentials.expired and credentials.refresh_token:

        credentials.refresh(Request())

    if not credentials or not credentials.valid:

        flow = InstalledAppFlow.from_client_secrets_file(
            CREDENTIALS_FILE,
            SCOPES
        )

        credentials = flow.run_local_server(
            port=0
        )

        with open(TOKEN_FILE, "w") as token_file:

            token_file.write(
                credentials.to_json()
            )

    service = build(
        "gmail",
        "v1",
        credentials=credentials
    )

    return service


# ============================================================
# FIND LABEL
# ============================================================

def find_label(service, label_name):

    results = (
        service.users()
        .labels()
        .list(userId="me")
        .execute()
    )

    labels = results.get(
        "labels",
        []
    )

    for label in labels:

        if label["name"] == label_name:

            return label["id"]

    return None


# ============================================================
# GET EMAILS FROM LABEL
# ============================================================

def get_label_messages(service, label_id):

    results = (
        service.users()
        .messages()
        .list(
            userId="me",
            labelIds=[label_id],
            maxResults=10
        )
        .execute()
    )

    return results.get(
        "messages",
        []
    )


# ============================================================
# GET EMAIL DETAILS
# ============================================================

def get_email(service, message_id):

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

    headers = message.get(
        "payload",
        {}
    ).get(
        "headers",
        []
    )

    subject = ""
    sender = ""
    date = ""

    for header in headers:

        name = header["name"].lower()

        if name == "subject":
            subject = header["value"]

        elif name == "from":
            sender = header["value"]

        elif name == "date":
            date = header["value"]

    return {
        "id": message_id,
        "subject": subject,
        "from": sender,
        "date": date
    }


# ============================================================
# MAIN TEST
# ============================================================

if __name__ == "__main__":

    print("================================")
    print("GMAIL LABEL TEST")
    print("================================")

    service = get_gmail_service()

    print(
        f"\nLooking for label: {TARGET_LABEL}"
    )

    label_id = find_label(
        service,
        TARGET_LABEL
    )

    if not label_id:

        print(
            "\nERROR: Target label was not found."
        )

        raise SystemExit

    print(
        f"Label found. Gmail ID: {label_id}"
    )

    messages = get_label_messages(
        service,
        label_id
    )

    print(
        f"\nMessages found: {len(messages)}"
    )

    if not messages:

        print(
            "\nNo emails currently have this label."
        )

    else:

        print(
            "\nEMAILS IN AUTOMATION LABEL:"
        )

        for message in messages:

            email = get_email(
                service,
                message["id"]
            )

            print("\n----------------------------")

            print(
                f"Subject: {email['subject']}"
            )

            print(
                f"From: {email['from']}"
            )

            print(
                f"Date: {email['date']}"
            )

            print(
                f"Message ID: {email['id']}"
            )

    print("\n================================")
    print("LABEL TEST COMPLETE")
    print("================================")