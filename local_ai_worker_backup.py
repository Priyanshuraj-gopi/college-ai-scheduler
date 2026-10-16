import json
import re
import urllib.request
import urllib.error


# ============================================================
# CONFIGURATION
# ============================================================

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_MODEL = "qwen3:4b"


# ============================================================
# PRIVACY FIREWALL
# ============================================================

SENSITIVE_PATTERNS = [

    # Authentication
    r"\botp\b",
    r"\bone[- ]time password\b",
    r"\bverification code\b",
    r"\bverification pin\b",
    r"\bsecurity code\b",
    r"\bauthentication code\b",
    r"\b2fa\b",
    r"\btwo[- ]factor authentication\b",
    r"\blogin code\b",
    r"\bsign[- ]in code\b",
    r"\bconfirmation code\b",

    # Credentials
    r"\bpassword\b",
    r"\bpasscode\b",
    r"\brecovery code\b",
    r"\bbackup code\b",
    r"\bapi key\b",
    r"\baccess token\b",
    r"\bsecret key\b",

    # Financial secrets
    r"\bcvv\b",
    r"\bcvc\b",
    r"\bupi pin\b",
    r"\bcard pin\b",
    r"\bbank(?:ing)? pin\b",
]


def privacy_firewall(email_text):

    text = email_text.lower()

    for pattern in SENSITIVE_PATTERNS:

        if re.search(pattern, text, re.IGNORECASE):

            return {
                "sensitive": True,
                "send_to_ai": False,
                "reason": "Potential sensitive information detected."
            }

    return {
        "sensitive": False,
        "send_to_ai": True,
        "reason": "No obvious sensitive-information pattern detected."
    }


# ============================================================
# OLLAMA AI CLASSIFIER
# ============================================================

def analyze_with_ollama(email_text):

    system_prompt = """
You are the first-stage email relevance classifier
for a personal automation system.

Your job is to determine whether an email contains
information that could require an action, reminder,
calendar event, task, or follow-up.

Relevant categories:
- academic
- college_event
- package
- personal_event
- deadline
- travel
- document
- financial
- announcement
- other

Irrelevant categories:
- promotion
- newsletter
- marketing
- spam
- routine_non_actionable

Return ONLY a JSON object.

Do not use markdown.
Do not use code fences.
Do not explain your answer.
Do not include any text before or after the JSON.

Use exactly:

{
  "relevant": true,
  "category": "package",
  "priority": "medium"
}
"""

    user_prompt = f"""
Classify this email.

EMAIL:

{email_text}
"""

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        "stream": False,
        "think": False,
        "format": "json",
        "options": {
            "temperature": 0
        }
    }

    request_data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        OLLAMA_URL,
        data=request_data,
        headers={
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:

        with urllib.request.urlopen(
            request,
            timeout=180
        ) as response:

            raw_response = response.read().decode("utf-8")

        print("\nRAW OLLAMA RESPONSE:")
        print(raw_response)

        ollama_response = json.loads(raw_response)

        message = ollama_response.get(
            "message",
            {}
        )

        model_output = message.get(
            "content",
            ""
        ).strip()

        if not model_output:

            return {
                "success": False,
                "error": "Ollama returned an empty message."
            }

        print("\nMODEL CONTENT:")
        print(model_output)

        parsed = json.loads(model_output)

        return {
            "success": True,
            "result": parsed
        }

    except urllib.error.URLError as error:

        return {
            "success": False,
            "error": f"Could not connect to Ollama: {error}"
        }

    except json.JSONDecodeError as error:

        return {
            "success": False,
            "error": (
                "Invalid JSON returned by Ollama: "
                f"{error}"
            )
        }

    except Exception as error:

        return {
            "success": False,
            "error": str(error)
        }


# ============================================================
# COMPLETE EMAIL PROCESSOR
# ============================================================

def process_email(email_text):

    print("\n================================")
    print("LOCAL AI EMAIL WORKER")
    print("================================")

    print("\nEmail received by local worker.")

    # --------------------------------------------------------
    # PRIVACY FIREWALL
    # --------------------------------------------------------

    privacy_result = privacy_firewall(
        email_text
    )

    print("\nPRIVACY FIREWALL:")

    print(
        json.dumps(
            privacy_result,
            indent=2
        )
    )

    if not privacy_result["send_to_ai"]:

        print("\n================================")
        print("EMAIL BLOCKED FROM AI")
        print("================================")

        print(
            "Reason:",
            privacy_result["reason"]
        )

        return {
            "status": "blocked",
            "privacy": privacy_result
        }

    # --------------------------------------------------------
    # OLLAMA
    # --------------------------------------------------------

    print("\nSAFE FOR LOCAL AI.")

    print(
        "Sending email to Ollama..."
    )

    print(
        "Model:",
        OLLAMA_MODEL
    )

    ai_result = analyze_with_ollama(
        email_text
    )

    if not ai_result["success"]:

        print("\nOLLAMA ERROR")

        print(
            ai_result["error"]
        )

        return {
            "status": "error",
            "ai": ai_result
        }

    # --------------------------------------------------------
    # SUCCESS
    # --------------------------------------------------------

    print("\n================================")
    print("OLLAMA RESULT")
    print("================================")

    print(
        json.dumps(
            ai_result["result"],
            indent=2
        )
    )

    print("\n================================")
    print("PROCESSING COMPLETE")
    print("================================")

    return {
        "status": "processed",
        "privacy": privacy_result,
        "ai": ai_result["result"]
    }


# ============================================================
# STANDALONE TEST
# ============================================================

if __name__ == "__main__":

    print("LOCAL AI WORKER TEST")
    print("====================")

    test_email = """
Subject: Your College Backpack has shipped

Your order for College Backpack has been shipped.

Carrier: BlueDart.

Expected delivery: August 17, 2026.

Please make arrangements to receive your package.
"""

    result = process_email(
        test_email
    )

    print("\nFINAL RESULT:")

    print(
        json.dumps(
            result,
            indent=2
        )
    )