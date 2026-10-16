import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build


SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly"
]

CREDENTIALS_FILE = "credentials.json"
TOKEN_FILE = "gmail_token.json"


def get_gmail_service():

    credentials = None

    # ========================================================
    # LOAD EXISTING TOKEN
    # ========================================================

    if os.path.exists(TOKEN_FILE):

        try:

            credentials = Credentials.from_authorized_user_file(
                TOKEN_FILE,
                SCOPES
            )

        except Exception as error:

            print("\nExisting Gmail token could not be loaded.")
            print("Reason:", str(error))

            credentials = None

    # ========================================================
    # VALID TOKEN
    # ========================================================

    if credentials and credentials.valid:

        print("\nExisting Gmail OAuth token is valid.")

        return build(
            "gmail",
            "v1",
            credentials=credentials
        )

    # ========================================================
    # REFRESH EXPIRED TOKEN
    # ========================================================

    if credentials and credentials.expired and credentials.refresh_token:

        print("\nGmail access token expired.")
        print("Attempting token refresh...")

        try:

            credentials.refresh(Request())

            with open(
                TOKEN_FILE,
                "w",
                encoding="utf-8"
            ) as token_file:

                token_file.write(
                    credentials.to_json()
                )

            print(
                "Gmail OAuth token refreshed successfully."
            )

            return build(
                "gmail",
                "v1",
                credentials=credentials
            )

        except Exception as error:

            print("\n================================")
            print("GMAIL TOKEN REFRESH FAILED")
            print("================================")

            print(
                "Reason:",
                str(error)
            )

            print(
                "\nStored refresh token is no longer usable."
            )

            print(
                "Removing old token and starting fresh OAuth..."
            )

            try:

                os.remove(TOKEN_FILE)

            except OSError:

                pass

            credentials = None

    # ========================================================
    # FRESH OAUTH
    # ========================================================

    if not credentials or not credentials.valid:

        if not os.path.exists(CREDENTIALS_FILE):

            raise FileNotFoundError(
                "credentials.json was not found."
            )

        print("\n================================")
        print("FRESH GMAIL OAUTH")
        print("================================")

        flow = InstalledAppFlow.from_client_secrets_file(
            CREDENTIALS_FILE,
            SCOPES
        )

        credentials = flow.run_local_server(
            port=0,
            access_type="offline",
            prompt="consent"
        )

        with open(
            TOKEN_FILE,
            "w",
            encoding="utf-8"
        ) as token_file:

            token_file.write(
                credentials.to_json()
            )

        print(
            "Fresh Gmail OAuth token saved."
        )

    # ========================================================
    # FINAL VALIDATION
    # ========================================================

    if not credentials or not credentials.valid:

        raise RuntimeError(
            "Gmail OAuth completed, but credentials are still invalid."
        )

    return build(
        "gmail",
        "v1",
        credentials=credentials
    )

def list_labels(service):

    print("\n================================")
    print("GMAIL CONNECTION TEST")
    print("================================")

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

    print("\nGMAIL LABELS FOUND:\n")

    for label in labels:

        print(
            f"- {label['name']}"
        )

    print("\n================================")
    print("GMAIL TEST COMPLETE")
    print("================================")


if __name__ == "__main__":

    print(
        "Starting Gmail read-only connection..."
    )

    service = get_gmail_service()

    list_labels(service)