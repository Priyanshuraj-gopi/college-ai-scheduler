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

    # Authentication / verification
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

    # Financial authentication
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
# DATE VALIDATION
# ============================================================

def date_is_supported(
    extracted_date,
    email_text
):

    if not extracted_date:
        return True

    # --------------------------------------------------------
    # Strict YYYY-MM-DD validation
    # --------------------------------------------------------

    if not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}",
        extracted_date
    ):

        return False


    year, month, day = map(
        int,
        extracted_date.split("-")
    )


    if not (
        1 <= month <= 12
        and
        1 <= day <= 31
    ):

        return False


    # --------------------------------------------------------
    # Look for the corresponding month/day in the actual
    # email.
    #
    # Supports:
    #
    # August 17, 2026
    # August 17th, 2026
    # Aug 17, 2026
    # August 17th
    # 17 August 2026
    # 17th August
    # 17/08/2026
    # 17-08-2026
    # --------------------------------------------------------

    month_names = [
        "",
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december"
    ]

    month_short = [
        "",
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec"
    ]

    month_name = month_names[month]
    month_abbr = month_short[month]


    # --------------------------------------------------------
    # Month name followed by day
    # --------------------------------------------------------

    month_day_pattern = (
        rf"\b(?:{month_name}|{month_abbr})"
        rf"\s+{day}(?:st|nd|rd|th)?"
        rf"(?:\s*,?\s*\d{{4}})?\b"
    )

    if re.search(
        month_day_pattern,
        email_text,
        re.IGNORECASE
    ):

        return True


    # --------------------------------------------------------
    # Day followed by month name
    # --------------------------------------------------------

    day_month_pattern = (
        rf"\b{day}(?:st|nd|rd|th)?"
        rf"\s+(?:{month_name}|{month_abbr})"
        rf"(?:\s*,?\s*\d{{4}})?\b"
    )

    if re.search(
        day_month_pattern,
        email_text,
        re.IGNORECASE
    ):

        return True


    # --------------------------------------------------------
    # Numeric date
    # --------------------------------------------------------

    numeric_patterns = [

        rf"\b{day:02d}[/-]{month:02d}"
        rf"(?:[/-]\d{{2,4}})?\b",

        rf"\b{month:02d}[/-]{day:02d}"
        rf"(?:[/-]\d{{2,4}})?\b",

        rf"\b{year}[/-]{month:02d}[/-]{day:02d}\b",

    ]


    for pattern in numeric_patterns:

        if re.search(
            pattern,
            email_text,
            re.IGNORECASE
        ):

            return True


    return False


# ============================================================
# STRICT LOCAL RELEVANCE GATE
# ============================================================

def local_relevance_gate(
    email_text,
    ai_result
):

    text = email_text.lower()

    category = str(
        ai_result.get(
            "category",
            ""
        )
    ).lower()

    subject_title = (
        str(
            ai_result.get(
                "title",
                ""
            )
        )
        .lower()
    )

    action_required = bool(
        ai_result.get(
            "action_required",
            False
        )
    )


    # --------------------------------------------------------
    # Explicitly irrelevant model result
    # --------------------------------------------------------

    if not ai_result.get(
        "relevant",
        False
    ):

        return {
            "approved": False,
            "reason": "Qwen classified the email as irrelevant."
        }


    # --------------------------------------------------------
    # Categories that should never automatically reach Gemini
    # --------------------------------------------------------

    blocked_categories = {

        "informational",
        "irrelevant"
    }


    if category in blocked_categories:

        return {
            "approved": False,
            "reason": (
                "Informational/non-actionable category."
            )
        }


    # --------------------------------------------------------
    # Promotional/newsletter language
    #
    # We only block these when there is no clear actionable
    # deadline/event/task signal.
    # --------------------------------------------------------

    promotional_patterns = [

        r"\bunsubscribe\b",
        r"\bnewsletter\b",
        r"\bweekly roundup\b",
        r"\bmonthly roundup\b",
        r"\bmarketing\b",
        r"\bpromotion\b",
        r"\bpromotional\b",
        r"\bexclusive offer\b",
        r"\bspecial offer\b",
        r"\bshop now\b",
        r"\bbuy now\b",
        r"\bdiscount\b",
        r"\bcoupon\b",
        r"\bdeal\b",
        r"\bdeals\b",
        r"\bflash sale\b",
        r"\bsale ends\b",
    ]


    promotional_match = any(
        re.search(
            pattern,
            text,
            re.IGNORECASE
        )
        for pattern in promotional_patterns
    )


    # --------------------------------------------------------
    # Strong actionable signals
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
        r"\bclass\b",
        r"\blecture\b",
        r"\borientation\b",
        r"\bmeeting\b",
        r"\bseminar\b",
        r"\bworkshop\b",
        r"\bcompetition\b",
        r"\bappointment\b",
        r"\binterview\b",
        r"\btravel\b",
        r"\bflight\b",
        r"\bdeparture\b",
        r"\bdelivery\b",
        r"\bdelivered\b",
        r"\bshipped\b",
        r"\bdispatched\b",
        r"\bpackage\b",
        r"\border\b",
        r"\bpayment due\b",
        r"\bpayment deadline\b",
        r"\bmandatory\b",
        r"\brequired\b",
        r"\bmust\b",
        r"\baction required\b",
    ]


    has_actionable_signal = any(
        re.search(
            pattern,
            text,
            re.IGNORECASE
        )
        for pattern in actionable_patterns
    )


    # --------------------------------------------------------
    # Reject obvious promotional/newsletter material unless
    # it contains a strong genuine action signal.
    # --------------------------------------------------------

    if (
        promotional_match
        and
        not has_actionable_signal
    ):

        return {
            "approved": False,
            "reason": (
                "Appears promotional/newsletter-like "
                "without a strong actionable signal."
            )
        }


    # --------------------------------------------------------
    # Notifications from common platforms
    #
    # These are not automatically rejected if they contain a
    # genuine actionable signal.
    # --------------------------------------------------------

    platform_notification_patterns = [

        r"share request",
        r"you've been invited",
        r"invitation",
        r"profile",
        r"job alert",
        r"job alerts",
        r"activity notification",
        r"new follower",
        r"someone viewed",
        r"recommendation",
        r"suggested for you",
    ]


    platform_notification = any(
        re.search(
            pattern,
            text,
            re.IGNORECASE
        )
        for pattern in platform_notification_patterns
    )


    if (
        platform_notification
        and
        not has_actionable_signal
    ):

        return {
            "approved": False,
            "reason": (
                "Routine platform notification without "
                "a strong actionable signal."
            )
        }


    # --------------------------------------------------------
    # If Qwen says action is required but there is absolutely
    # no actionable signal, don't automatically escalate.
    #
    # Exception:
    # academic / personal_event / deadline / package /
    # college_event categories are allowed if Qwen has
    # classified them meaningfully.
    # --------------------------------------------------------

    meaningful_categories = {

        "package",
        "college_event",
        "academic",
        "deadline",
        "personal_event"
    }


    if (
        action_required
        and
        not has_actionable_signal
        and
        category not in meaningful_categories
    ):

        return {
            "approved": False,
            "reason": (
                "No strong actionable signal detected."
            )
        }


    # --------------------------------------------------------
    # Approved
    # --------------------------------------------------------

    return {
        "approved": True,
        "reason": (
            "Email contains a meaningful actionable signal."
        )
    }


# ============================================================
# QWEN CLASSIFIER
# ============================================================

def analyze_with_ollama(
    email_text
):

    system_prompt = """

You are the LOCAL FIRST-STAGE EMAIL CLASSIFIER
for a personal college automation system.

Your job is NOT to send every interesting email
to another AI.

Your job is to identify ONLY emails that genuinely
deserve automated personal action.

Return ONLY valid JSON.

Do not use markdown.
Do not use code fences.
Do not explain your answer.

Use exactly:

{
  "relevant": true,
  "category": "package",
  "title": "Short useful title",
  "summary": "One sentence summary",
  "date": "YYYY-MM-DD or empty string",
  "start_time": "HH:MM or empty string",
  "end_time": "HH:MM or empty string",
  "deadline": "YYYY-MM-DD or empty string",
  "action_required": true,
  "priority": "low"
}


============================================================
RELEVANCE STANDARD
============================================================

Set relevant=true ONLY when the email contains information
that can reasonably require a personal reminder, calendar
event, task, deadline, package reminder, appointment,
academic action, or important personal action.

Do NOT mark an email relevant merely because it is useful,
interesting, or addressed to the user.


============================================================
IRRELEVANT EMAILS
============================================================

Set:

"relevant": false

for:

- newsletters
- marketing emails
- promotions
- advertisements
- sales
- generic platform notifications
- job-alert digests
- social-media notifications
- profile-building prompts
- routine GitHub notifications
- routine LinkedIn notifications
- generic recommendations
- ordinary informational updates
- promotional event newsletters
- general community newsletters
- emails that do not require the user to do anything


============================================================
ACTIONABLE EMAILS
============================================================

Set relevant=true for genuine:

- college classes
- lectures
- exams
- assignments
- assignment deadlines
- registrations
- applications
- mandatory college activities
- orientations
- seminars
- workshops
- college meetings
- competitions
- appointments
- travel
- package deliveries
- order shipments
- genuine personal commitments
- important forms or document submissions
- payments with an actual deadline
- other clearly actionable personal matters


============================================================
PACKAGE RULE
============================================================

Use category "package" for:

- shipped orders
- dispatched orders
- delivery notifications
- expected deliveries
- package arrival information

A package email may be relevant even if the user does not
need to do anything immediately.


============================================================
CATEGORY RULES
============================================================

Use "college_event" for:

- orientation
- workshops
- seminars
- college-organized events
- meetings
- competitions
- official college activities

Use "academic" for:

- classes
- lectures
- examinations
- assignments
- academic notices
- timetable changes
- academic deadlines

Use "deadline" for:

- registrations
- applications
- submissions
- payments
- forms
- documents
- other actions that must be completed by a date

Use "personal_event" for:

- appointments
- personal meetings
- birthdays
- travel
- personal commitments

Use "announcement" ONLY for a genuinely important notice
that matters to the user but does not clearly require
a task or event.

Use "informational" only when information is genuinely
important enough to retain but does not require action.

Use "irrelevant" for ordinary non-actionable mail.


============================================================
DATE RULES
============================================================

Extract dates ONLY when actually present in the email.

Examples:

August 17, 2026
August 17th, 2026
August 17th
17 August 2026
17th August
17/08/2026

If a year is omitted but the date clearly refers to the
current/future calendar period, you may use the current year.

DO NOT invent dates.

If no date is present:

"date": ""

If the email gives a deadline:

put it in "deadline".


============================================================
TIME RULES
============================================================

Use 24-hour HH:MM.

9:30 AM -> "09:30"
3 PM -> "15:00"
5:45 PM -> "17:45"

If no explicit time:

"start_time": ""
"end_time": ""

DO NOT invent times.


============================================================
ACTION REQUIRED
============================================================

Set action_required=true when the user genuinely needs
to:

- attend
- submit
- register
- apply
- prepare
- receive
- pay
- remember
- complete an action

Do NOT set action_required=true simply because the email
is interesting.


============================================================
PRIORITY
============================================================

high:
- urgent
- mandatory
- exam
- imminent deadline
- important required action

medium:
- useful actionable matter
- ordinary assignment
- ordinary event
- registration

low:
- minor reminder
- package
- low-importance matter


============================================================
IMPORTANT
============================================================

Be conservative.

It is better to leave an ordinary email unprocessed than
to create an unnecessary calendar event or task.

Only mark relevant=true when there is a genuine reason for
personal automation.
"""


    user_prompt = f"""
Classify this email according to the rules.

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


    request_data = json.dumps(
        payload
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
            timeout=180
        ) as response:

            raw_response = (
                response
                .read()
                .decode("utf-8")
            )


        print("\nRAW OLLAMA RESPONSE:")
        print(raw_response)


        ollama_response = json.loads(
            raw_response
        )


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
                "error": (
                    "Ollama returned an empty message."
                )
            }


        print("\nMODEL CONTENT:")
        print(model_output)


        parsed = json.loads(
            model_output
        )


        return {
            "success": True,
            "result": parsed
        }


    except urllib.error.URLError as error:

        return {
            "success": False,
            "error": (
                f"Could not connect to Ollama: {error}"
            )
        }


    except json.JSONDecodeError as error:

        return {
            "success": False,
            "error": (
                f"Invalid JSON returned by Ollama: {error}"
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

def process_email(
    email_text
):

    print("\n================================")
    print("LOCAL AI EMAIL WORKER")
    print("================================")

    print(
        "\nEmail received by local worker."
    )


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
    # QWEN
    # --------------------------------------------------------

    print(
        "\nSAFE FOR LOCAL AI."
    )

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


    if not ai_result[
        "success"
    ]:

        print(
            "\nOLLAMA ERROR"
        )

        print(
            ai_result["error"]
        )

        return {
            "status": "error",
            "ai": ai_result
        }


    data = ai_result[
        "result"
    ]


    # --------------------------------------------------------
    # DATE SAFETY
    # --------------------------------------------------------

    email_date = data.get(
        "date",
        ""
    )

    email_deadline = data.get(
        "deadline",
        ""
    )


    if email_date:

        if not date_is_supported(
            email_date,
            email_text
        ):

            print(
                "\nSAFETY CHECK:"
            )

            print(
                "Qwen returned an unsupported event date."
            )

            print(
                "Removing date:",
                email_date
            )

            data["date"] = ""


    if email_deadline:

        if not date_is_supported(
            email_deadline,
            email_text
        ):

            print(
                "\nSAFETY CHECK:"
            )

            print(
                "Qwen returned an unsupported deadline."
            )

            print(
                "Removing deadline:",
                email_deadline
            )

            data["deadline"] = ""


    # --------------------------------------------------------
    # STRICT LOCAL RELEVANCE GATE
    # --------------------------------------------------------

    gate_result = local_relevance_gate(
        email_text,
        data
    )


    print(
        "\n================================"
    )

    print(
        "LOCAL RELEVANCE GATE"
    )

    print(
        "================================"
    )

    print(
        "Approved:",
        gate_result["approved"]
    )

    print(
        "Reason:",
        gate_result["reason"]
    )


    # --------------------------------------------------------
    # OVERRIDE QWEN RELEVANCE
    # --------------------------------------------------------

    if not gate_result[
        "approved"
    ]:

        data["relevant"] = False

        data["action_required"] = False


    # --------------------------------------------------------
    # FINAL RESULT
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
            data,
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

        "ai": data,

        "gate": gate_result
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
Subject: Your College Backpack has shipped

Your order for College Backpack has been shipped.

Carrier: BlueDart.

Expected delivery: August 17, 2026.

Please make arrangements to receive your package.
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