import json
import re
import urllib.request
import urllib.error
from html import unescape


# ============================================================
# CONFIGURATION & CAPACITY LIMITERS
# ============================================================

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_UNLOAD_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "qwen3:4b"

# Timeout
OLLAMA_TIMEOUT = 35

# CPU Capacity Limiter:
# Caps Ollama to 3 CPU threads (on a 12-core CPU, this keeps 9 cores completely free)
OLLAMA_NUM_THREADS = 3

# RAM Optimization:
# num_ctx=1024 cuts KV Cache memory footprint by ~50% compared to 2048
OLLAMA_CONTEXT = 1024
OLLAMA_MAX_OUTPUT = 80

# Keep-alive in RAM: 30s instead of default 5m
OLLAMA_KEEP_ALIVE = "30s"

# Maximum email characters sent to local AI:
# 1500 chars covers Subject + Sender + full key introductory paragraphs
# and dramatically reduces CPU prompt processing time.
MAX_AI_BODY = 1500


def unload_ollama_model():
    """
    Explicitly ejects the model from RAM immediately by setting keep_alive to 0.
    """
    try:
        data = json.dumps({
            "model": OLLAMA_MODEL,
            "keep_alive": 0
        }).encode("utf-8")
        req = urllib.request.Request(
            OLLAMA_UNLOAD_URL,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            response.read()
        print(f"[Ollama] Model '{OLLAMA_MODEL}' unloaded from RAM successfully.")
    except Exception:
        pass


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

        if re.search(
            pattern,
            text,
            re.IGNORECASE
        ):

            return {
                "sensitive": True,
                "send_to_ai": False,
                "reason": (
                    "Potential sensitive information detected."
                )
            }

    return {
        "sensitive": False,
        "send_to_ai": True,
        "reason": (
            "No obvious sensitive-information pattern detected."
        )
    }


# ============================================================
# EMAIL CLEANING
# ============================================================

def clean_email_text(email_text):
    """
    Convert raw Gmail content into compact plain text.

    Removes:
    - HTML
    - scripts
    - styles
    - tracking URLs
    - quoted replies
    - common email headers
    - signatures
    - excessive whitespace
    """

    if not email_text:
        return ""

    text = str(email_text)

    # --------------------------------------------------------
    # Decode HTML entities
    # --------------------------------------------------------

    text = unescape(text)

    # --------------------------------------------------------
    # Remove scripts, styles and technical HTML blocks
    # --------------------------------------------------------

    text = re.sub(
        r"<(script|style|noscript|svg|head).*?>.*?</\1>",
        " ",
        text,
        flags=re.IGNORECASE | re.DOTALL
    )

    # --------------------------------------------------------
    # Remove HTML comments
    # --------------------------------------------------------

    text = re.sub(
        r"<!--.*?-->",
        " ",
        text,
        flags=re.DOTALL
    )

    # --------------------------------------------------------
    # Turn structural HTML into line breaks
    # --------------------------------------------------------

    text = re.sub(
        r"<\s*(br|/p|/div|/tr|/li|/h[1-6])\s*/?\s*>",
        "\n",
        text,
        flags=re.IGNORECASE
    )

    # --------------------------------------------------------
    # Remove remaining HTML tags
    # --------------------------------------------------------

    text = re.sub(
        r"<[^>]+>",
        " ",
        text
    )

    # --------------------------------------------------------
    # Remove URLs
    # --------------------------------------------------------

    text = re.sub(
        r"https?://\S+",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"www\.\S+",
        " ",
        text,
        flags=re.IGNORECASE
    )

    # --------------------------------------------------------
    # Remove common tracking / newsletter noise
    # --------------------------------------------------------

    text = re.sub(
        r"\b(?:utm_[a-z_]+|tracking|unsubscribe|"
        r"view\s+in\s+browser)\b[^\n]*",
        " ",
        text,
        flags=re.IGNORECASE
    )

    # --------------------------------------------------------
    # Process lines
    # --------------------------------------------------------

    lines = text.splitlines()

    useful_lines = []

    for line in lines:

        stripped = line.strip()

        if not stripped:
            continue

        # Quoted reply
        if stripped.startswith(">"):
            continue

        # Common reply headers
        if re.match(
            r"^(on .+wrote:|from:|sent:|to:|cc:|subject:)\s*",
            stripped,
            flags=re.IGNORECASE
        ):
            continue

        useful_lines.append(stripped)

    text = "\n".join(
        useful_lines
    )

    # --------------------------------------------------------
    # Remove signatures / footer sections
    # --------------------------------------------------------

    signature_markers = [
        "\n--\n",
        "\nregards,\n",
        "\nbest regards,\n",
        "\nkind regards,\n",
        "\nsincerely,\n",
        "\nunsubscribe\n",
    ]

    lower_text = text.lower()

    cut_positions = []

    for marker in signature_markers:

        position = lower_text.find(
            marker
        )

        if position >= 0:
            cut_positions.append(
                position
            )

    if cut_positions:

        earliest = min(
            cut_positions
        )

        text = text[:earliest]

    # --------------------------------------------------------
    # Normalize whitespace
    # --------------------------------------------------------

    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )

    # Strip non-printable / control characters and invisible zero-width unicode
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u200b-\u200f\ufeff]", "", text)

    text = text.strip()

    return text


# ============================================================
# COMPACT EMAIL
# ============================================================

def compact_email(email_text):
    """
    Reduce the cleaned email to a small AI payload.

    The beginning is prioritized because it often contains:
    - announcement
    - event
    - deadline
    - academic information

    The end is retained because calls-to-action can appear there.
    """

    cleaned = clean_email_text(
        email_text
    )

    if len(cleaned) <= MAX_AI_BODY:
        return cleaned

    # Keep approximately 70% from the beginning
    # and 30% from the end.
    first_part = int(
        MAX_AI_BODY * 0.70
    )

    last_part = (
        MAX_AI_BODY
        - first_part
    )

    return (
        cleaned[:first_part]
        + "\n\n[CONTENT TRUNCATED]\n\n"
        + cleaned[-last_part:]
    )


# ============================================================
# JSON EXTRACTION
# ============================================================

def extract_json_object(text):
    """
    Recover a JSON object even if the model accidentally
    returns surrounding text or markdown.
    """

    if not text:

        raise ValueError(
            "Ollama returned empty output."
        )

    text = text.strip()

    # --------------------------------------------------------
    # Remove markdown fences
    # --------------------------------------------------------

    text = re.sub(
        r"```json",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"```",
        "",
        text
    )

    text = text.strip()

    # --------------------------------------------------------
    # Try complete response first
    # --------------------------------------------------------

    try:

        parsed = json.loads(
            text
        )

        if isinstance(parsed, dict):
            return parsed

    except json.JSONDecodeError:
        pass

    # --------------------------------------------------------
    # Find JSON object inside response
    # --------------------------------------------------------

    start = text.find("{")

    if start == -1:

        raise ValueError(
            "No JSON object found in Ollama output."
        )

    depth = 0
    in_string = False
    escaped = False

    for index in range(
        start,
        len(text)
    ):

        character = text[index]

        if escaped:

            escaped = False
            continue

        if character == "\\" and in_string:

            escaped = True
            continue

        if character == '"':

            in_string = not in_string
            continue

        if in_string:
            continue

        if character == "{":

            depth += 1

        elif character == "}":

            depth -= 1

            if depth == 0:

                candidate = text[
                    start:index + 1
                ]

                try:

                    parsed = json.loads(
                        candidate
                    )

                    if isinstance(parsed, dict):
                        return parsed

                except json.JSONDecodeError as error:

                    raise ValueError(
                        "JSON object found but invalid: "
                        + str(error)
                    )

    raise ValueError(
        "Ollama output contained an incomplete JSON object."
    )


# ============================================================
# VALIDATE AI RESULT
# ============================================================

def validate_ai_result(result):

    if not isinstance(
        result,
        dict
    ):

        raise ValueError(
            "AI result is not a JSON object."
        )

    required_fields = [
        "relevant",
        "category",
        "priority"
    ]

    for field in required_fields:

        if field not in result:

            raise ValueError(
                "AI result missing required field: "
                + field
            )

    # --------------------------------------------------------
    # Normalize relevant
    # --------------------------------------------------------

    relevant = result["relevant"]

    if isinstance(
        relevant,
        str
    ):

        value = relevant.strip().lower()

        if value == "true":

            result["relevant"] = True

        elif value == "false":

            result["relevant"] = False

        else:

            raise ValueError(
                "AI 'relevant' field is not boolean."
            )

    elif not isinstance(
        relevant,
        bool
    ):

        raise ValueError(
            "AI 'relevant' field is not boolean."
        )

    # --------------------------------------------------------
    # Normalize category
    # --------------------------------------------------------

    result["category"] = str(
        result["category"]
    ).strip().lower()

    # --------------------------------------------------------
    # Normalize priority
    # --------------------------------------------------------

    result["priority"] = str(
        result["priority"]
    ).strip().lower()

    allowed_priorities = {
        "low",
        "medium",
        "high"
    }

    if result["priority"] not in allowed_priorities:

        result["priority"] = "medium"

    return result


# ============================================================
# OLLAMA AI CLASSIFIER
# ============================================================

def analyze_with_ollama(email_text):

    compact_text = compact_email(email_text)

    print(
        "AI input after cleaning:",
        len(compact_text),
        "characters"
    )

    system_prompt = """
You are an email relevance classifier.

Determine whether this email requires meaningful
attention, an action, reminder, calendar event,
task, deadline, follow-up, or academic attention.

Categories:
academic
college_event
package
personal_event
deadline
travel
document
financial
announcement
other

Promotions, newsletters, marketing and routine
non-actionable emails should have relevant=false.

You MUST return all three fields.

Return EXACTLY one JSON object:

{
  "relevant": true,
  "category": "academic",
  "priority": "medium"
}

The "priority" field is REQUIRED.

Allowed priority values:
low
medium
high

No explanation.
No reasoning.
No markdown.
No code fences.
No extra fields.
"""

    user_prompt = (
        "Classify this email.\n\n"
        "EMAIL:\n"
        + compact_text
    )

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

        "keep_alive": OLLAMA_KEEP_ALIVE,

        "options": {
            "temperature": 0,
            "num_thread": OLLAMA_NUM_THREADS,
            "num_ctx": OLLAMA_CONTEXT,
            "num_predict": OLLAMA_MAX_OUTPUT,
            "top_k": 10,
            "top_p": 0.8
        }
    }

    request_data = json.dumps(
        payload,
        ensure_ascii=False
    ).encode("utf-8")

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
            timeout=OLLAMA_TIMEOUT
        ) as response:

            raw_response = (
                response
                .read()
                .decode("utf-8")
            )

        ollama_response = json.loads(
            raw_response
        )

        message = ollama_response.get(
            "message",
            {}
        )

        model_output = (
            message
            .get(
                "content",
                ""
            )
            .strip()
        )

        if not model_output:

            return {
                "success": False,
                "error": "Ollama returned empty content."
            }

        print("\nOllama raw content:")
        print(model_output)

        # ----------------------------------------------------
        # EXTRACT JSON
        # ----------------------------------------------------

        try:

            parsed = extract_json_object(
                model_output
            )

        except Exception as error:

            return {
                "success": False,
                "error": (
                    "Ollama produced invalid JSON: "
                    + str(error)
                )
            }

        # ----------------------------------------------------
        # RECOVER MISSING PRIORITY
        # ----------------------------------------------------
        #
        # Qwen occasionally returns only:
        #
        # {
        #   "relevant": false,
        #   "category": "other"
        # }
        #
        # Instead of failing the entire email, assign the
        # safest default priority.
        #
        # This does NOT override a priority supplied by AI.
        # ----------------------------------------------------

        if "relevant" not in parsed:
            print(
                "\nWARNING: AI returned non-standard JSON without 'relevant'."
            )
            print(
                "Applying safe default: relevant=False, category=other, priority=low"
            )
            parsed["relevant"] = False
            if "category" not in parsed:
                parsed["category"] = "other"
            if "priority" not in parsed:
                parsed["priority"] = "low"

        if "priority" not in parsed:

            print(
                "\nWARNING: AI omitted priority."
            )

            print(
                "Applying safe default: medium"
            )

            parsed["priority"] = "medium"

        # ----------------------------------------------------
        # VALIDATE RESULT
        # ----------------------------------------------------

        try:

            parsed = validate_ai_result(
                parsed
            )

        except Exception as error:

            return {
                "success": False,
                "error": (
                    "AI result validation failed: "
                    + str(error)
                )
            }

        return {
            "success": True,
            "result": parsed
        }

    # --------------------------------------------------------
    # CONNECTION ERROR
    # --------------------------------------------------------

    except urllib.error.URLError as error:

        return {
            "success": False,
            "error": (
                "Could not connect to Ollama: "
                + str(error)
            )
        }

    # --------------------------------------------------------
    # TIMEOUT
    # --------------------------------------------------------

    except TimeoutError:

        return {
            "success": False,
            "error": (
                "Ollama request timed out after "
                + str(OLLAMA_TIMEOUT)
                + " seconds."
            )
        }

    # --------------------------------------------------------
    # INVALID HTTP RESPONSE
    # --------------------------------------------------------

    except json.JSONDecodeError as error:

        return {
            "success": False,
            "error": (
                "Invalid Ollama HTTP response JSON: "
                + str(error)
            )
        }

    # --------------------------------------------------------
    # GENERAL ERROR
    # --------------------------------------------------------

    except Exception as error:

        error_text = str(error)

        if "timed out" in error_text.lower():

            return {
                "success": False,
                "error": (
                    "Ollama request timed out after "
                    + str(OLLAMA_TIMEOUT)
                    + " seconds."
                )
            }

        return {
            "success": False,
            "error": error_text
        }

# ============================================================
# COMPLETE EMAIL PROCESSOR
# ============================================================

def process_email(email_text):

    print(
        "\n================================"
    )

    print(
        "LOCAL AI EMAIL WORKER"
    )

    print(
        "CPU-OPTIMIZED OLLAMA MODE"
    )

    print(
        "================================"
    )

    print(
        "\nEmail received by local worker."
    )

    # --------------------------------------------------------
    # PRIVACY FIREWALL
    # --------------------------------------------------------

    privacy_result = privacy_firewall(
        email_text
    )

    print(
        "\nPRIVACY FIREWALL:"
    )

    print(
        json.dumps(
            privacy_result,
            indent=2
        )
    )

    if not privacy_result[
        "send_to_ai"
    ]:

        print(
            "\n================================"
        )

        print(
            "EMAIL BLOCKED FROM AI"
        )

        print(
            "================================"
        )

        print(
            "Reason:",
            privacy_result["reason"]
        )

        return {
            "status": "blocked",
            "privacy": privacy_result
        }

    # --------------------------------------------------------
    # COMPRESSION DIAGNOSTIC
    # --------------------------------------------------------

    compacted = compact_email(
        email_text
    )

    raw_length = len(
        email_text
    )

    compact_length = len(
        compacted
    )

    removed = (
        raw_length
        - compact_length
    )

    print(
        "\nRAW EMAIL CHARACTERS:",
        raw_length
    )

    print(
        "COMPACT AI CHARACTERS:",
        compact_length
    )

    print(
        "CHARACTERS REMOVED:",
        removed
    )

    # --------------------------------------------------------
    # SEND TO OLLAMA
    # --------------------------------------------------------

    print(
        "\nSAFE FOR LOCAL AI."
    )

    print(
        "Sending compact request to Ollama..."
    )

    print(
        "Model:",
        OLLAMA_MODEL
    )

    print(
        "Context:",
        OLLAMA_CONTEXT
    )

    print(
        "Max output tokens:",
        OLLAMA_MAX_OUTPUT
    )

    print(
        "Timeout:",
        OLLAMA_TIMEOUT,
        "seconds"
    )

    ai_result = analyze_with_ollama(
        email_text
    )

    # --------------------------------------------------------
    # AI FAILURE
    # --------------------------------------------------------

    if not ai_result[
        "success"
    ]:

        print(
            "\n================================"
        )

        print(
            "OLLAMA ERROR"
        )

        print(
            "================================"
        )

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

    print(
        "\n================================"
    )

    print(
        "OLLAMA RESULT"
    )

    print(
        "================================"
    )

    print(
        json.dumps(
            ai_result["result"],
            indent=2
        )
    )

    print(
        "\n================================"
    )

    print(
        "PROCESSING COMPLETE"
    )

    print(
        "================================"
    )

    return {
        "status": "processed",
        "privacy": privacy_result,
        "ai": ai_result["result"]
    }


# ============================================================
# STANDALONE TEST
# ============================================================

if __name__ == "__main__":

    print(
        "LOCAL AI WORKER TEST"
    )

    print(
        "===================="
    )

    test_email = """
Subject: Important Academic Announcement

Dear Student,

Your college has announced an important academic
orientation session.

The session will take place next Monday at 10:00 AM.
Students are requested to attend the session.

Please add this event to your calendar.

Regards,
College Administration
"""

    result = process_email(
        test_email
    )

    print(
        "\nFINAL RESULT:"
    )

    print(
        json.dumps(
            result,
            indent=2
        )
    )