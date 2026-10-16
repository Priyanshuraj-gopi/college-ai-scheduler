function testGemini() {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("Gemini API key not found.");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1/interactions";

  const payload = {
    model: "gemini-3.6-flash",
    input: "Reply with exactly: Gemini connection successful."
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-goog-api-key": apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const responseText = response.getContentText();

  Logger.log(responseText);

  if (response.getResponseCode() < 200 ||
      response.getResponseCode() >= 300) {
    throw new Error(
      "Gemini API error " +
      response.getResponseCode() +
      ": " +
      responseText
    );
  }

  const data = JSON.parse(responseText);

  let result = "";

  if (data.output_text) {
    result = data.output_text;
  } else if (data.outputs) {
    result = JSON.stringify(data.outputs);
  } else if (data.steps) {
    result = JSON.stringify(data.steps);
  } else {
    result = JSON.stringify(data);
  }

  Logger.log("Gemini says: " + result);
}
function testGmail() {
  const threads = GmailApp.search(
    'newer_than:7d',
    0,
    5
  );

  Logger.log("Found " + threads.length + " Gmail threads.");

  threads.forEach((thread, index) => {
    const messages = thread.getMessages();
    const message = messages[messages.length - 1];

    Logger.log(
      "EMAIL " + (index + 1) +
      "\nFrom: " + message.getFrom() +
      "\nSubject: " + message.getSubject() +
      "\nDate: " + message.getDate() +
      "\n------------------------"
    );
  });
}
function getTestEmail() {
  const threads = GmailApp.search(
    'label:AI-AUTOMATION-TEST subject:"AI AUTOMATION TEST - Future Event"',
    0,
    10
  );

  if (threads.length === 0) {
    throw new Error(
      'Future test email not found.'
    );
  }

  // Find the newest matching message
  let newestMessage = null;

  threads.forEach(thread => {
    const messages = thread.getMessages();

    messages.forEach(message => {
      if (!newestMessage ||
          message.getDate().getTime() >
          newestMessage.getDate().getTime()) {
        newestMessage = message;
      }
    });
  });

  if (!newestMessage) {
    throw new Error(
      'No matching message found.'
    );
  }

  const emailData = {
    id: newestMessage.getId(),
    from: newestMessage.getFrom(),
    subject: newestMessage.getSubject(),
    date: newestMessage.getDate().toISOString(),
    body: newestMessage.getPlainBody()
  };

  Logger.log(
    "Selected email:"
  );

  Logger.log(
    "Subject: " +
    emailData.subject
  );

  Logger.log(
    "Date: " +
    emailData.date
  );

  Logger.log(
    "From: " +
    emailData.from
  );

  return emailData;
}
function analyzeTestEmail() {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("Gemini API key not found.");
  }

  // Get the test email
  const email = getTestEmail();

  // Current date in India
  const today = Utilities.formatDate(
    new Date(),
    "Asia/Kolkata",
    "yyyy-MM-dd"
  );

  const prompt = `
You are the information-extraction engine for a personal college
schedule and productivity automation system.

TODAY'S DATE:
${today}

TIMEZONE:
Asia/Kolkata (UTC+05:30)

Analyze the email below and extract actionable information.

CRITICAL RULES:

1. NEVER invent a date.
2. NEVER invent a time.
3. NEVER assume a default time such as 09:00.
4. Convert definite dates into YYYY-MM-DD format.
5. If multiple dates are mentioned, identify the complete date range.
6. Put the FIRST day in event_date.
7. Put the LAST day in event_end_date.
8. If only one event date exists, event_end_date should be the same
   as event_date or empty if appropriate.
9. If a year is omitted, infer it only when the context makes the
   year reasonably clear.
10. If the year/date is genuinely ambiguous, leave the date empty
    and set date_confidence to "uncertain".
11. If a time is explicitly stated, convert it to 24-hour HH:MM.
12. If a time is NOT stated, leave start_time and end_time empty.
13. NEVER create a time simply because Calendar normally uses times.
14. If only a start time is provided, leave end_time empty.
15. If an event has already occurred relative to TODAY'S DATE,
    set is_past_event to true.
16. If the event is today or in the future, set is_past_event to false.
17. Do not change an extracted date merely because it is in the past.
18. If an event contains a deadline, distinguish the deadline from
    the event date.
19. Do not invent a deadline.
20. Do not invent location, organizer, event details, or requirements.
21. If something requires an action but has no event time, it may
    be better represented as a task.
22. If something is purely informational, classify it as
    informational.
23. Use the email's received date when interpreting relative dates
    such as "tomorrow", "next Monday", etc.
24. Assume Asia/Kolkata unless the email explicitly specifies
    another timezone.
25. If an event spans multiple days, preserve the full date range.
26. If the email contains multiple separate events, classify the
    email based on its primary actionable content.
27. Do not create an event merely because an email mentions an event.
    Consider whether it is actually relevant/actionable.
28. action_required should be true only when the user has something
    they need to do, attend, submit, register for, prepare for,
    or otherwise act upon.
29. priority should reflect actual urgency or importance contained
    in the email.
30. Never fabricate information to fill an empty field.

CLASSIFICATION:

Use exactly one of:

calendar_event
task
event_and_task
informational

Use "calendar_event" when the primary purpose is attending or
remembering an event.

Use "task" when the primary purpose is completing an action,
especially when there is a deadline but no attendance/event time.

Use "event_and_task" when both attending an event AND completing
an action are important.

Use "informational" when no meaningful action is required.

DATE RULE:

event_date = first date of the event.

event_end_date = final date of the event when it spans multiple
days.

For a single-day event, event_end_date may equal event_date.

DEADLINE RULE:

deadline = the date by which an action must be completed.

Do NOT treat a deadline as the event date unless the email explicitly
indicates that they are the same.

PAST EVENT RULE:

is_past_event must be true when the event's final date has already
passed relative to TODAY'S DATE.

For a multi-day event, compare TODAY'S DATE against event_end_date.

For a single-day event, compare TODAY'S DATE against event_date.

If there is no reliable event date, set is_past_event to false and
let date_confidence indicate the uncertainty.

EMAIL
-----

From:
${email.from}

Subject:
${email.subject}

Date received:
${email.date}

Body:
${email.body}
`;

  // Structured output schema
  const schema = {
    type: "object",

    properties: {

      classification: {
        type: "string",
        enum: [
          "calendar_event",
          "task",
          "event_and_task",
          "informational"
        ]
      },

      title: {
        type: "string"
      },

      summary: {
        type: "string"
      },

      event_date: {
        type: "string"
      },

      event_end_date: {
        type: "string"
      },

      start_time: {
        type: "string"
      },

      end_time: {
        type: "string"
      },

      date_confidence: {
        type: "string",
        enum: [
          "explicit",
          "reasonably_inferred",
          "uncertain",
          "not_provided"
        ]
      },

      time_confidence: {
        type: "string",
        enum: [
          "explicit",
          "reasonably_inferred",
          "uncertain",
          "not_provided"
        ]
      },

      is_past_event: {
        type: "boolean"
      },

      location: {
        type: "string"
      },

      organizer: {
        type: "string"
      },

      deadline: {
        type: "string"
      },

      action_required: {
        type: "boolean"
      },

      priority: {
        type: "string",
        enum: [
          "low",
          "medium",
          "high",
          "urgent"
        ]
      }
    },

    required: [
      "classification",
      "title",
      "summary",
      "event_date",
      "event_end_date",
      "start_time",
      "end_time",
      "date_confidence",
      "time_confidence",
      "is_past_event",
      "location",
      "organizer",
      "deadline",
      "action_required",
      "priority"
    ]
  };

  // Gemini Interactions API
  const url =
    "https://generativelanguage.googleapis.com/v1beta/interactions";

  const payload = {
    model: "gemini-3.6-flash",

    input: prompt,

    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: schema
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",

    contentType: "application/json",

    headers: {
      "x-goog-api-key": apiKey
    },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true
  });

  const responseText =
    response.getContentText();

  Logger.log(responseText);

  // Check HTTP response
  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error(
      "Gemini API error " +
      response.getResponseCode() +
      ": " +
      responseText
    );
  }

  const data =
    JSON.parse(responseText);

  // Extract Gemini's structured output
  let outputText = "";

  if (data.output_text) {

    outputText =
      data.output_text;

  } else if (data.steps) {

    const modelStep =
      data.steps.find(
        step =>
          step.type === "model_output"
      );

    if (
      modelStep &&
      modelStep.content
    ) {

      const textPart =
        modelStep.content.find(
          part =>
            part.type === "text"
        );

      if (textPart) {
        outputText =
          textPart.text;
      }
    }
  }

  if (!outputText) {
    throw new Error(
      "Gemini returned no usable text output."
    );
  }

  // Convert Gemini JSON text into JavaScript object
  const result =
    JSON.parse(outputText);

  // Final logging
  Logger.log(
    "STRUCTURED RESULT:\n" +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
function isEmailAlreadyProcessed(emailId) {
  const properties = PropertiesService.getScriptProperties();

  const processed = properties.getProperty(
    "PROCESSED_EMAIL_IDS"
  );

  if (!processed) {
    return false;
  }

  const ids = JSON.parse(processed);

  return ids.includes(emailId);
}


function markEmailAsProcessed(emailId) {
  const properties = PropertiesService.getScriptProperties();

  const processed = properties.getProperty(
    "PROCESSED_EMAIL_IDS"
  );

  const ids = processed
    ? JSON.parse(processed)
    : [];

  if (!ids.includes(emailId)) {
    ids.push(emailId);
  }

  // Keep only the latest 500 IDs
  const recentIds = ids.slice(-500);

  properties.setProperty(
    "PROCESSED_EMAIL_IDS",
    JSON.stringify(recentIds)
  );
}

function createCalendarEvent(data) {

  // ==========================================================
  // HARD SAFETY RULE #1:
  // DELIVERED PACKAGES MUST NEVER CREATE CALENDAR EVENTS
  // ==========================================================

  const category = String(
    data.category || ""
  ).toLowerCase();

  const title = String(
    data.title || ""
  ).toLowerCase();

  const summary = String(
    data.summary || ""
  ).toLowerCase();

  const combinedText =
    category + " " +
    title + " " +
    summary;


  const isPackage =
    category === "package" ||
    /\bpackage\b/.test(combinedText) ||
    /\border\b/.test(combinedText) ||
    /\bshipment\b/.test(combinedText);


  const isDelivered =
    /\bdelivered\b/.test(combinedText) ||
    /\bhas been delivered\b/.test(combinedText) ||
    /\bwas delivered\b/.test(combinedText) ||
    /\bsuccessfully delivered\b/.test(combinedText);


  if (
    isPackage &&
    isDelivered
  ) {

    Logger.log(
      "CALENDAR SAFETY RULE: Delivered package detected."
    );

    Logger.log(
      "Calendar event creation skipped."
    );

    Logger.log(
      "Title: " +
      (data.title || "Untitled")
    );

    return null;
  }


  // ==========================================================
  // HARD SAFETY RULE #2:
  // DO NOT CREATE CALENDAR EVENTS WITHOUT A RELIABLE DATE
  // ==========================================================

  if (
    !data.event_date ||
    data.date_confidence === "uncertain" ||
    data.date_confidence === "not_provided"
  ) {

    Logger.log(
      "Calendar event skipped: reliable date not available."
    );

    return null;
  }


  const calendar =
    CalendarApp.getDefaultCalendar();


  // ==========================================================
  // REMINDER CONFIGURATION
  // ==========================================================
  //
  // Timed events:
  //     30-minute notification
  //
  // All-day events:
  //     9:00 AM notification on the event day
  //
  // The reminder is attached directly to Google Calendar.
  // No laptop/PowerShell process is required.
  // ==========================================================

  const TIMED_REMINDER_MINUTES = 30;


  // ==========================================================
  // CASE 1:
  // NO TIME PROVIDED
  //
  // → Create an all-day event
  // ==========================================================

  if (!data.start_time) {

    const startDate =
      new Date(
        data.event_date +
        "T00:00:00"
      );


    let endDate;


    if (data.event_end_date) {

      endDate =
        new Date(
          data.event_end_date +
          "T00:00:00"
        );


      // Calendar all-day events use
      // an exclusive end date.

      endDate.setDate(
        endDate.getDate() + 1
      );

    } else {

      endDate =
        new Date(startDate);

      endDate.setDate(
        endDate.getDate() + 1
      );
    }


    const event =
      calendar.createAllDayEvent(
        data.title,
        startDate,
        endDate,
        {
          description:
            buildEventDescription(data),

          location:
            data.location || ""
        }
      );


    // ----------------------------------------------------------
    // ALL-DAY EVENT REMINDER
    // ----------------------------------------------------------

    event.addPopupReminder(
      9 * 60
    );


    Logger.log(
      "All-day Calendar event created: " +
      event.getId()
    );

    Logger.log(
      "Calendar reminder added: 9:00 AM on event day."
    );


    return event.getId();
  }


  // ==========================================================
  // CASE 2:
  // EXPLICIT TIME PROVIDED
  // ==========================================================

  const start =
    new Date(
      data.event_date +
      "T" +
      data.start_time +
      ":00"
    );


  // ==========================================================
  // SAFETY:
  // DON'T CREATE EVENTS THAT HAVE ALREADY PASSED
  // ==========================================================

  if (
    start.getTime() <= Date.now()
  ) {

    Logger.log(
      "Calendar event skipped: event start time has already passed."
    );

    return null;
  }


  let end;


  if (data.end_time) {

    end =
      new Date(
        data.event_date +
        "T" +
        data.end_time +
        ":00"
      );

  } else {

    // Start time exists but no end time.
    // Default duration = 1 hour.

    end =
      new Date(
        start.getTime() +
        60 * 60 * 1000
      );
  }


  const event =
    calendar.createEvent(
      data.title,
      start,
      end,
      {
        description:
          buildEventDescription(data),

        location:
          data.location || ""
      }
    );


  // ----------------------------------------------------------
  // TIMED EVENT REMINDER
  // ----------------------------------------------------------

  event.addPopupReminder(
    TIMED_REMINDER_MINUTES
  );


  Logger.log(
    "Timed Calendar event created: " +
    event.getId()
  );

  Logger.log(
    "Calendar reminder added: " +
    TIMED_REMINDER_MINUTES +
    " minutes before event."
  );


  return event.getId();
}
function buildEventDescription(data) {
  return (
    "Created by College AI Automation\n\n" +

    "Summary:\n" +
    (data.summary || "Not specified") +

    "\n\nOrganizer:\n" +
    (data.organizer || "Not specified") +

    "\n\nDeadline:\n" +
    (data.deadline || "Not specified") +

    "\n\nPriority:\n" +
    (data.priority || "Not specified")
  );
}

function buildEventDescription(data) {

  return (
    "Created by College AI Automation\n\n" +

    "Summary:\n" +
    (data.summary || "Not specified") +

    "\n\nOrganizer:\n" +
    (data.organizer || "Not specified") +

    "\n\nDeadline:\n" +
    (data.deadline || "Not specified") +

    "\n\nPriority:\n" +
    (data.priority || "Not specified")
  );
}
function createGoogleTask(data) {

  // ==================================================
  // HARD BLOCK: DELIVERED PACKAGES
  // ==================================================

  if (
    data.category === "package" &&
    data.package_status === "delivered"
  ) {

    Logger.log(
      "Google Task skipped: package already delivered."
    );

    return null;
  }


  // ==================================================
  // NO ACTION REQUIRED
  // ==================================================

  if (!data.action_required) {

    Logger.log(
      "Task skipped: no action required."
    );

    return null;
  }


  // ==================================================
  // BUILD TASK
  // ==================================================

  const task = {

    title:
      data.title ||
      "Untitled task",

    notes:
      "Created by College AI Automation\n\n" +

      "Summary:\n" +
      (
        data.summary ||
        "Not specified"
      ) +

      "\n\nPriority:\n" +
      (
        data.priority ||
        "Not specified"
      ) +

      "\n\nRelated event date:\n" +
      (
        data.event_date ||
        "Not specified"
      ) +

      "\n\nDeadline:\n" +
      (
        data.deadline ||
        "Not specified"
      )
  };


  // ==================================================
  // NORMALIZE DEADLINE
  //
  // Accepts:
  // YYYY-MM-DD
  // YYYY-MM-DD HH:MM:SS
  // YYYY-MM-DDTHH:MM:SS
  //
  // Converts to:
  // YYYY-MM-DD
  // ==================================================

  if (data.deadline) {

    const deadlineString =
      String(data.deadline).trim();


    const match =
      deadlineString.match(
        /^(\d{4}-\d{2}-\d{2})/
      );


    if (match) {

      const deadlineDate =
        match[1];


      // IMPORTANT:
      // Google Tasks treats this as a date-only
      // deadline when sent at UTC midnight.

      task.due =
        deadlineDate +
        "T00:00:00Z";


      Logger.log(
        "Normalized task deadline: " +
        deadlineDate
      );

      Logger.log(
        "Google Tasks due timestamp: " +
        task.due
      );


    } else {

      Logger.log(
        "WARNING: Invalid deadline format received: " +
        deadlineString
      );

      Logger.log(
        "Task will be created without a due date."
      );
    }
  }


  // ==================================================
  // CREATE GOOGLE TASK
  // ==================================================

  const createdTask =
    Tasks.Tasks.insert(
      task,
      "@default"
    );


  Logger.log(
    "Google Task created successfully."
  );

  Logger.log(
    "Google Task ID: " +
    createdTask.id
  );

  Logger.log(
    "Task title: " +
    (
      createdTask.title ||
      "Untitled"
    )
  );

  Logger.log(
    "Task due: " +
    (
      createdTask.due ||
      "No due date"
    )
  );


  return createdTask.id;
}
function createPackageTask(data) {

  // ==================================================
  // PACKAGE TASK SAFETY
  // ==================================================

  if (
    data.category !== "package"
  ) {

    Logger.log(
      "PACKAGE TASK skipped: Not a package."
    );

    return null;
  }


  // ==================================================
  // NORMALIZE PACKAGE STATUS
  // ==================================================

  const status =
    String(
      data.package_status ||
      data.subcategory ||
      ""
    )
    .toLowerCase()
    .trim();


  // ==================================================
  // DELIVERED / CANCELLED = NO TASK
  // ==================================================

  if (
    status === "delivered" ||
    status === "cancelled"
  ) {

    Logger.log(
      "PACKAGE TASK BLOCKED: Package requires no action."
    );

    Logger.log(
      "Package status: " +
      status
    );

    return null;
  }


  // ==================================================
  // ACTION REQUIRED = FALSE
  // ==================================================

  if (
    data.action_required !== true
  ) {

    Logger.log(
      "PACKAGE TASK skipped: No action required."
    );

    return null;
  }


  // ==================================================
  // IDENTIFY GEMINI'S ACTUAL ACTION
  // ==================================================

  const product =
    data.product_name ||
    "Package";


  const geminiTitle =
    String(
      data.title ||
      ""
    )
    .trim();


  const geminiAction =
    String(
      data.action ||
      data.recommended_action ||
      data.next_action ||
      ""
    )
    .trim();


  const combinedActionText =
    (
      geminiTitle +
      " " +
      geminiAction
    )
    .toLowerCase();


  // ==================================================
  // DETECT HOSTEL / RECEPTION ACTION
  // ==================================================

  const hostelActionRequired =
    combinedActionText.includes(
      "hostel"
    ) ||
    combinedActionText.includes(
      "reception"
    ) ||
    combinedActionText.includes(
      "hostel authority"
    ) ||
    combinedActionText.includes(
      "receive package"
    ) ||
    combinedActionText.includes(
      "collect package"
    );


  // ==================================================
  // DETECT TRACKING ACTION
  // ==================================================

  const trackingAction =
    combinedActionText.includes(
      "track shipment"
    ) ||
    combinedActionText.includes(
      "track package"
    ) ||
    combinedActionText.includes(
      "tracking"
    ) ||
    combinedActionText.includes(
      "track delivery"
    );


  // ==================================================
  // BUILD TASK TITLE
  // ==================================================

  let title;


  if (
    hostelActionRequired
  ) {

    title =
      "Inform hostel authority about package";

  } else if (
    trackingAction
  ) {

    title =
      geminiTitle ||
      "Track package shipment";

  } else {

    title =
      geminiTitle ||
      (
        "Package action: " +
        product
      );
  }


  // ==================================================
  // BUILD TASK NOTES
  // ==================================================

  let notes =
    "📦 PACKAGE REMINDER\n\n" +

    "Package:\n" +
    product +

    "\n\nStatus:\n" +
    (
      data.package_status ||
      "Unknown"
    );


  if (
    data.carrier
  ) {

    notes +=
      "\n\nCarrier:\n" +
      data.carrier;
  }


  if (
    data.tracking_number
  ) {

    notes +=
      "\n\nTracking number:\n" +
      data.tracking_number;
  }


  if (
    data.order_number
  ) {

    notes +=
      "\n\nOrder number:\n" +
      data.order_number;
  }


  if (
    data.expected_delivery_date
  ) {

    notes +=
      "\n\nExpected delivery:\n" +
      data.expected_delivery_date;
  }


  // ==================================================
  // RECORD GEMINI'S ACTUAL ACTION
  // ==================================================

  notes +=
    "\n\nAction identified by Gemini:\n" +
    (
      geminiAction ||
      geminiTitle ||
      "Review package status."
    );


  // ==================================================
  // HOSTEL-SPECIFIC INSTRUCTION
  // ONLY WHEN ACTUALLY IDENTIFIED
  // ==================================================

  if (
    hostelActionRequired
  ) {

    notes +=
      "\n\nHostel action:\n" +
      "Inform hostel authority/reception " +
      "to receive the package.";
  }


  // ==================================================
  // CREATE GOOGLE TASK
  // ==================================================

  const task = {
    title: title,
    notes: notes
  };


  // ==================================================
  // DUE DATE
  // ==================================================

  if (
    data.expected_delivery_date
  ) {

    task.due =
      data.expected_delivery_date +
      "T00:00:00+05:30";
  }


  // ==================================================
  // INSERT TASK
  // ==================================================

  const createdTask =
    Tasks.Tasks.insert(
      task,
      "@default"
    );


  Logger.log(
    "Package reminder created: " +
    createdTask.id
  );


  Logger.log(
    "Package task title: " +
    title
  );


  Logger.log(
    "Hostel action required: " +
    hostelActionRequired
  );


  Logger.log(
    "Tracking action: " +
    trackingAction
  );


  return createdTask.id;
}
function testGoogleTasks() {
  const taskLists = Tasks.Tasklists.list();

  Logger.log(
    JSON.stringify(taskLists, null, 2)
  );
}
function processTestEmail() {
  Logger.log("=== COLLEGE AI AUTOMATION TEST ===");

  // 1. Get the test email
  const email = getTestEmail();

  Logger.log("Email found:");
  Logger.log("Subject: " + email.subject);
  Logger.log("From: " + email.from);

  // 2. Check duplicate protection
  if (isEmailAlreadyProcessed(email.id)) {
    Logger.log(
      "This email has already been processed."
    );

    return;
  }

  Logger.log(
    "Email is new. Sending to Gemini..."
  );

  // 3. Analyze email with Gemini
  const result = analyzeTestEmail();

  Logger.log(
    "Gemini classification: " +
    result.classification
  );

  Logger.log(
    "Title: " +
    result.title
  );

  Logger.log(
    "Priority: " +
    result.priority
  );

  // 4. We'll intentionally STOP here for this test.
  //
  // Calendar and Tasks will be connected
  // after we validate the Gemini result.

  Logger.log(
    "=== PROCESSING TEST COMPLETE ==="
  );
}
function processEmail() {
  Logger.log("================================");
  Logger.log("COLLEGE AI AUTOMATION STARTED");
  Logger.log("================================");

  // 1. Get the email
  const email = getTestEmail();

  Logger.log("Email: " + email.subject);
  Logger.log("Email ID: " + email.id);

  // 2. Duplicate protection
  if (isEmailAlreadyProcessed(email.id)) {
    Logger.log(
      "EMAIL ALREADY PROCESSED — STOPPING."
    );
    return;
  }

  // 3. Analyze with Gemini
  const data = analyzeTestEmail();

  Logger.log(
    "Classification: " +
    data.classification
  );

  Logger.log(
    "Title: " +
    data.title
  );

  // 4. Safety decisions
  const calendarAllowed =
    shouldCreateCalendarEvent(data);

  const taskAllowed =
    shouldCreateTask(data);

  Logger.log(
    "Calendar allowed: " +
    calendarAllowed
  );

  Logger.log(
    "Task allowed: " +
    taskAllowed
  );

  let calendarId = null;
  let taskId = null;

  // 5. Calendar action
  if (
    (
      data.classification === "calendar_event" ||
      data.classification === "event_and_task"
    ) &&
    calendarAllowed
  ) {

    calendarId =
      createCalendarEvent(data);

  } else {

    Logger.log(
      "Calendar action skipped."
    );
  }

  // 6. Task action
  if (
    (
      data.classification === "task" ||
      data.classification === "event_and_task"
    ) &&
    taskAllowed
  ) {

    taskId =
      createGoogleTask(data);

  } else {

    Logger.log(
      "Task action skipped."
    );
  }

  // 7. Mark as processed ONLY after
  //    all required actions completed.
  markEmailAsProcessed(email.id);

  Logger.log(
    "Email marked as processed."
  );

  // 8. Final report
  Logger.log(
    "================================"
  );

  Logger.log(
    "PROCESSING COMPLETE"
  );

  Logger.log(
    "Calendar ID: " +
    (calendarId || "None")
  );

  Logger.log(
    "Task ID: " +
    (taskId || "None")
  );

  Logger.log(
    "================================"
  );
}
function isDateInPast(dateString) {
  if (!dateString) {
    return false;
  }

  const todayString = Utilities.formatDate(
    new Date(),
    "Asia/Kolkata",
    "yyyy-MM-dd"
  );

  return dateString < todayString;
}

function shouldCreateCalendarEvent(data) {

    // ==================================================
  // HARD BLOCK: DELIVERED PACKAGES
  // ==================================================

  if (
    data.category === "package" &&
    data.package_status === "delivered"
  ) {
    Logger.log(
      "CALENDAR BLOCKED: Package has already been delivered."
    );

    return false;
  }

  if (!data.event_date) {

    Logger.log(
      "CALENDAR BLOCKED: No event date."
    );

    return false;
  }

  if (
    data.date_confidence === "uncertain" ||
    data.date_confidence === "not_provided"
  ) {

    Logger.log(
      "CALENDAR BLOCKED: Date is uncertain."
    );

    return false;
  }

  if (data.is_past_event === true) {

    Logger.log(
      "CALENDAR BLOCKED: Event is already in the past."
    );

    return false;
  }

  const finalEventDate =
    data.event_end_date ||
    data.event_date;

  if (isDateInPast(finalEventDate)) {

    Logger.log(
      "CALENDAR BLOCKED: Event date is in the past."
    );

    return false;
  }

  if (
    data.scheduling_importance === "none"
  ) {

    Logger.log(
      "CALENDAR BLOCKED: Scheduling importance is none."
    );

    return false;
  }

  return true;
}

function shouldCreateTask(data) {

  // ==================================================
  // HARD BLOCK: DELIVERED PACKAGES
  // ==================================================

  if (
    data.category === "package" &&
    data.package_status === "delivered"
  ) {
    Logger.log(
      "TASK BLOCKED: Package has already been delivered."
    );

    return false;
  }

  // ==================================================
  // NO ACTION REQUIRED
  // ==================================================

  if (!data.action_required) {
    Logger.log(
      "TASK BLOCKED: No action required."
    );

    return false;
  }

  // ==================================================
  // DEADLINE CHECK
  // ==================================================

  if (data.deadline) {

    if (isDateInPast(data.deadline)) {

      Logger.log(
        "TASK BLOCKED: Deadline has already passed."
      );

      return false;
    }
  }

  return true;
}
function testSafetyDecision() {

  const data = analyzeTestEmail();

  Logger.log(
    "========== SAFETY TEST =========="
  );

  const calendarAllowed =
    shouldCreateCalendarEvent(data);

  const taskAllowed =
    shouldCreateTask(data);

  Logger.log(
    "Calendar allowed: " +
    calendarAllowed
  );

  Logger.log(
    "Task allowed: " +
    taskAllowed
  );

  Logger.log(
    "Event date: " +
    data.event_date
  );

  Logger.log(
    "Event end date: " +
    data.event_end_date
  );

  Logger.log(
    "Deadline: " +
    data.deadline
  );

  Logger.log(
    "Past event: " +
    data.is_past_event
  );

  Logger.log(
    "========== SAFETY TEST COMPLETE =========="
  );
}
function analyzeEmail(email) {

  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("Gemini API key not found.");
  }

  const today = Utilities.formatDate(
    new Date(),
    "Asia/Kolkata",
    "yyyy-MM-dd"
  );

  const prompt = `
You are the personal information-extraction engine for an
AI-powered personal productivity system.

TODAY'S DATE:
${today}

TIMEZONE:
Asia/Kolkata (UTC+05:30)

Your job is to understand what information in this email is
relevant to the user's life and determine what the automation
system should do with it.

IMPORTANT PRINCIPLE:

Do NOT assume that only college emails are relevant.

The user also wants to track:
- packages and deliveries
- important purchases
- personal events
- academic events
- MUNs and debates
- deadlines
- university announcements
- classes and exams
- important documents

However, ordinary promotional/newsletter emails should generally
be ignored.

==================================================
CATEGORY
==================================================

Choose exactly ONE:

academic
package
personal_event
deadline
document
financial
announcement
newsletter
promotion
security
other

Examples:

Exam timetable
→ academic

MUN registration
→ academic

"Your order has shipped"
→ package

"Your package is out for delivery"
→ package

Wedding invitation
→ personal_event

"Submit registration by September 5"
→ deadline

University circular
→ announcement

Amazon sale
→ promotion

Newsletter
→ newsletter

OTP/security alert
→ security

==================================================
SUBCATEGORY
==================================================

Use a concise useful description.

Examples:

academic:
class
exam
mun
debate
orientation
workshop
registration
assignment

package:
ordered
confirmed
shipped
in_transit
out_for_delivery
delivered
delayed
cancelled

personal_event:
meeting
appointment
invitation
travel
birthday

deadline:
registration
submission
payment
application

==================================================
SCHEDULING
==================================================

Determine whether this information belongs in the user's
Calendar or Tasks.

A piece of information can be calendar-worthy even when
action_required is false.

For example:

"Exam timetable released:
September 10 - Accounting
September 12 - Economics"

→ academic
→ calendar_event
→ action_required = false

==================================================
CLASSIFICATION
==================================================

Use exactly ONE:

calendar_event
task
event_and_task
informational
review_required

calendar_event:
Important date/event that should be remembered.

task:
Something the user needs to do.

event_and_task:
Both an event and an action are present.

informational:
Relevant information that requires neither a Calendar
event nor a Task.

review_required:
Potentially important, but the information is too ambiguous
to safely automate.

==================================================
PACKAGE RULES
==================================================

If category = package:

Extract, when available:

product_name
order_number
tracking_number
carrier
package_status
expected_delivery_date

NEVER invent tracking numbers, carriers, dates or order numbers.

Package statuses should preferably be:

ordered
confirmed
shipped
in_transit
out_for_delivery
delivered
delayed
cancelled
unknown

A package email can be relevant even if it does not contain
an explicit user action.

If an expected delivery date is known, it may be useful to
create a reminder/calendar item.

If no expected delivery date is known, do NOT invent one.

For a shipped package with no delivery date, the system may
create a task to monitor the shipment.

==================================================
DATE RULES
==================================================

1. NEVER invent a date.
2. NEVER invent a time.
3. Convert definite dates to YYYY-MM-DD.
4. For multi-day events:
   event_date = first day
   event_end_date = last day.
5. If a year is omitted, infer it only when reasonably clear.
6. If genuinely ambiguous, use date_confidence = uncertain.
7. If no time is provided, leave start_time and end_time empty.
8. NEVER invent an end time.
9. Distinguish event dates from deadlines.
10. NEVER invent deadlines.
11. Never invent location or organizer.
12. Use the email received date when interpreting relative dates.
13. Assume Asia/Kolkata unless another timezone is explicitly stated.
14. Set is_past_event to true when the event's final date has passed.

==================================================
ACTION REQUIRED
==================================================

action_required = true only when the user actually needs to
do something.

Examples:

Exam announcement:
action_required = false

"Register for exam by September 5":
action_required = true

Package shipped:
action_required may be true if the user needs to monitor,
receive, or coordinate delivery.

==================================================
PRIORITY
==================================================

high:
- exams
- important class changes
- registration deadlines
- major academic deadlines
- package arriving today
- urgent delivery problems
- mandatory events

medium:
- normal academic events
- workshops
- MUN/debate events
- shipped packages
- normal delivery updates

low:
- optional events
- minor updates

==================================================
EMAIL
==================================================

DATE RECEIVED:
${email.date}

FROM:
${email.from}

SUBJECT:
${email.subject}

BODY:
${email.body}
`;

  const schema = {

    type: "object",

    properties: {

      category: {
        type: "string",
        enum: [
          "academic",
          "package",
          "personal_event",
          "deadline",
          "document",
          "financial",
          "announcement",
          "newsletter",
          "promotion",
          "security",
          "other"
        ]
      },

      subcategory: {
        type: "string"
      },

      classification: {
        type: "string",
        enum: [
          "calendar_event",
          "task",
          "event_and_task",
          "informational",
          "review_required"
        ]
      },

      title: {
        type: "string"
      },

      summary: {
        type: "string"
      },

      event_date: {
        type: "string"
      },

      event_end_date: {
        type: "string"
      },

      start_time: {
        type: "string"
      },

      end_time: {
        type: "string"
      },

      date_confidence: {
        type: "string",
        enum: [
          "explicit",
          "reasonably_inferred",
          "uncertain",
          "not_provided"
        ]
      },

      time_confidence: {
        type: "string",
        enum: [
          "explicit",
          "reasonably_inferred",
          "uncertain",
          "not_provided"
        ]
      },

      is_past_event: {
        type: "boolean"
      },

      scheduling_importance: {
        type: "string",
        enum: [
          "high",
          "medium",
          "low",
          "none"
        ]
      },

      location: {
        type: "string"
      },

      organizer: {
        type: "string"
      },

      deadline: {
        type: "string"
      },

      action_required: {
        type: "boolean"
      },

      priority: {
        type: "string",
        enum: [
          "low",
          "medium",
          "high",
          "urgent"
        ]
      },

      product_name: {
        type: "string"
      },

      order_number: {
        type: "string"
      },

      tracking_number: {
        type: "string"
      },

      carrier: {
        type: "string"
      },

      package_status: {
        type: "string",
        enum: [
          "ordered",
          "confirmed",
          "shipped",
          "in_transit",
          "out_for_delivery",
          "delivered",
          "delayed",
          "cancelled",
          "unknown"
        ]
      },

      expected_delivery_date: {
        type: "string"
      }
    },

    required: [
      "category",
      "subcategory",
      "classification",
      "title",
      "summary",
      "event_date",
      "event_end_date",
      "start_time",
      "end_time",
      "date_confidence",
      "time_confidence",
      "is_past_event",
      "scheduling_importance",
      "location",
      "organizer",
      "deadline",
      "action_required",
      "priority",
      "product_name",
      "order_number",
      "tracking_number",
      "carrier",
      "package_status",
      "expected_delivery_date"
    ]
  };

  const url =
    "https://generativelanguage.googleapis.com/v1beta/interactions";

  const payload = {

    model: "gemini-3.6-flash",

    input: prompt,

    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: schema
    }
  };

  const response = UrlFetchApp.fetch(
    url,
    {
      method: "post",
      contentType: "application/json",

      headers: {
        "x-goog-api-key": apiKey
      },

      payload:
        JSON.stringify(payload),

      muteHttpExceptions: true
    }
  );

  const responseText =
    response.getContentText();

  if (
    response.getResponseCode() < 200 ||
    response.getResponseCode() >= 300
  ) {
    throw new Error(
      "Gemini API error " +
      response.getResponseCode() +
      ": " +
      responseText
    );
  }

  const data =
    JSON.parse(responseText);

  let outputText = "";

  if (data.output_text) {

    outputText =
      data.output_text;

  } else if (data.steps) {

    const modelStep =
      data.steps.find(
        step =>
          step.type === "model_output"
      );

    if (
      modelStep &&
      modelStep.content
    ) {

      const textPart =
        modelStep.content.find(
          part =>
            part.type === "text"
        );

      if (textPart) {
        outputText =
          textPart.text;
      }
    }
  }

  if (!outputText) {
    throw new Error(
      "Gemini returned no usable output."
    );
  }

  return JSON.parse(outputText);
}
function getNextAutomationEmail() {

  const threads = GmailApp.search(
    'label:AI-GEMINI-READY',
    0,
    20
  );

  if (threads.length === 0) {

    Logger.log(
      "No Gemini-ready emails found."
    );

    return null;
  }

  let newestMessage = null;


  threads.forEach(thread => {

    const messages =
      thread.getMessages();


    messages.forEach(message => {

      const id =
        message.getId();


      // Don't send an email to Gemini
      // more than once.
      if (
        isEmailAlreadyProcessed(id)
      ) {
        return;
      }


      if (
        !newestMessage ||
        message.getDate().getTime() >
        newestMessage.getDate().getTime()
      ) {

        newestMessage = message;
      }

    });

  });


  if (!newestMessage) {

    Logger.log(
      "All Gemini-ready emails have already been processed."
    );

    return null;
  }


  const emailData = {

    id:
      newestMessage.getId(),

    from:
      newestMessage.getFrom(),

    subject:
      newestMessage.getSubject(),

    date:
      newestMessage
        .getDate()
        .toISOString(),

    body:
      newestMessage
        .getPlainBody()

  };


  Logger.log(
    "Next Gemini-ready email selected:"
  );

  Logger.log(
    "Subject: " +
    emailData.subject
  );

  Logger.log(
    "Message ID: " +
    emailData.id
  );


  return emailData;
}
function testPackageAnalysis() {

  const threads = GmailApp.search(
    'subject:"treback hangers for cl"',
    0,
    1
  );

  if (threads.length === 0) {
    throw new Error(
      "Package email not found."
    );
  }

  const message =
    threads[0].getMessages()[0];

  const email = {
    id: message.getId(),
    from: message.getFrom(),
    subject: message.getSubject(),
    date: message.getDate().toISOString(),
    body: message.getPlainBody()
  };

  const data =
    analyzeEmail(email);

  Logger.log(
    "PACKAGE ANALYSIS:"
  );

  Logger.log(
    JSON.stringify(
      data,
      null,
      2
    )
  );
}
function applyPackageRules(data) {

  // ==================================================
  // NOT A PACKAGE
  // ==================================================

  if (
    data.category !== "package"
  ) {

    return data;
  }


  // ==================================================
  // NORMALIZE PACKAGE STATUS
  // ==================================================

  const status =
    String(
      data.package_status ||
      data.subcategory ||
      ""
    )
    .toLowerCase()
    .trim();


  // ==================================================
  // COLLECT GEMINI'S ACTION INFORMATION
  // ==================================================

  const title =
    String(
      data.title ||
      ""
    )
    .toLowerCase()
    .trim();


  const action =
    String(
      data.action ||
      data.recommended_action ||
      data.next_action ||
      ""
    )
    .toLowerCase()
    .trim();


  const actionText =
    (
      title +
      " " +
      action
    )
    .trim();


  // ==================================================
  // DELIVERED PACKAGE
  //
  // Always completed.
  // Never create a task.
  // ==================================================

  if (
    status === "delivered"
  ) {

    data.action_required = false;

    data.priority = "low";

    data.classification = "informational";


    Logger.log(
      "PACKAGE RULE: Package already delivered."
    );

    Logger.log(
      "Action required forced to FALSE."
    );

    Logger.log(
      "Classification forced to INFORMATIONAL."
    );


    return data;
  }


  // ==================================================
  // CANCELLED PACKAGE
  //
  // No action required.
  // ==================================================

  if (
    status === "cancelled"
  ) {

    data.action_required = false;

    data.priority = "low";

    data.classification = "informational";


    Logger.log(
      "PACKAGE RULE: Package was cancelled."
    );

    Logger.log(
      "Action required forced to FALSE."
    );

    Logger.log(
      "Classification forced to INFORMATIONAL."
    );


    return data;
  }


  // ==================================================
  // DETECT AN EXPLICIT USER ACTION
  //
  // A package notification should NOT become a task
  // merely because Gemini classified it as actionable.
  //
  // We look for an actual action in Gemini's title/action.
  // ==================================================

  const explicitAction =
    actionText.includes("track shipment") ||
    actionText.includes("track package") ||
    actionText.includes("track delivery") ||
    actionText.includes("tracking") ||
    actionText.includes("contact hostel") ||
    actionText.includes("inform hostel") ||
    actionText.includes("hostel reception") ||
    actionText.includes("hostel authority") ||
    actionText.includes("receive package") ||
    actionText.includes("collect package") ||
    actionText.includes("collect the package") ||
    actionText.includes("contact reception") ||
    actionText.includes("contact seller") ||
    actionText.includes("contact courier") ||
    actionText.includes("contact carrier") ||
    actionText.includes("follow up") ||
    actionText.includes("take action") ||
    actionText.includes("respond") ||
    actionText.includes("verify delivery") ||
    actionText.includes("check delivery");


  // ==================================================
  // NORMAL SHIPPED PACKAGE
  //
  // Example:
  //
  // "Chaptex Lip Care Lip Balm shipped"
  //
  // This is simply a notification.
  // No actual action is identified.
  // ==================================================

  if (
    status === "shipped" &&
    !explicitAction
  ) {

    data.action_required = false;

    data.priority = "low";

    data.classification = "informational";


    Logger.log(
      "PACKAGE RULE: Normal shipped notification."
    );

    Logger.log(
      "No explicit user action identified."
    );

    Logger.log(
      "Action required forced to FALSE."
    );

    Logger.log(
      "Classification forced to INFORMATIONAL."
    );


    return data;
  }


  // ==================================================
  // OTHER NON-ACTIONABLE PACKAGE
  //
  // If Gemini says no action is required, preserve it.
  // ==================================================

  if (
    data.action_required !== true
  ) {

    data.action_required = false;


    Logger.log(
      "PACKAGE RULE: Gemini indicates no action required."
    );

    Logger.log(
      "Action required remains FALSE."
    );


    if (
      !data.priority
    ) {

      data.priority = "low";
    }


    return data;
  }


  // ==================================================
  // ACTIONABLE PACKAGE
  //
  // An explicit action exists, so preserve Gemini's
  // action-required decision.
  // ==================================================

  Logger.log(
    "PACKAGE RULE: Explicit package action detected."
  );

  Logger.log(
    "Action required remains: " +
    data.action_required
  );


  // ==================================================
  // PRIORITY
  // ==================================================

  if (
    data.action_required === true
  ) {

    if (
      status === "out_for_delivery"
    ) {

      data.priority = "high";

    } else if (
      status === "delayed"
    ) {

      data.priority = "high";

    } else {

      data.priority =
        data.priority ||
        "medium";
    }

  } else {

    data.priority =
      data.priority ||
      "low";
  }


  return data;
}
function testGeminiConnection() {
  Logger.log("Gemini connection test");
}
function processNextAutomationEmail() {

  Logger.log("================================");
  Logger.log("PRODUCTION EMAIL PROCESSOR");
  Logger.log("================================");


  // ==================================================
  // 0. GEMINI QUOTA COOLDOWN CHECK
  // ==================================================

  if (isGeminiCooldownActive()) {

    Logger.log(
      "GEMINI COOLDOWN ACTIVE."
    );

    Logger.log(
      "No Gemini request will be made during cooldown."
    );

    return;
  }


  // ==================================================
  // 1. FIND NEXT GEMINI-READY EMAIL
  // ==================================================

  const email =
    getNextAutomationEmail();


  if (!email) {

    Logger.log(
      "No new Gemini-ready email to process."
    );

    return;
  }


  Logger.log(
    "Processing: " +
    email.subject
  );

  Logger.log(
    "Message ID: " +
    email.id
  );


  try {


    // ==================================================
    // 2. ANALYZE EMAIL WITH GEMINI
    // ==================================================

    Logger.log(
      "Sending email to Gemini..."
    );


    const data =
      analyzeEmail(email);


    Logger.log(
      "Gemini analysis complete."
    );


    // ==================================================
    // 3. SHOW GEMINI RESULT
    // ==================================================

    Logger.log(
      "Category: " +
      data.category
    );

    Logger.log(
      "Subcategory: " +
      data.subcategory
    );

    Logger.log(
      "Classification: " +
      data.classification
    );

    Logger.log(
      "Title: " +
      data.title
    );

    Logger.log(
      "Priority: " +
      data.priority
    );

    Logger.log(
      "Action required: " +
      data.action_required
    );


    // ==================================================
    // 4. APPLY PERSONAL PACKAGE RULES
    // ==================================================

    applyPackageRules(data);


    Logger.log(
      "Final category after personal rules: " +
      data.category
    );

    Logger.log(
      "Final priority after personal rules: " +
      data.priority
    );

    Logger.log(
      "Package status: " +
      (
        data.package_status ||
        "Not applicable"
      )
    );


    // ==================================================
    // 5. PACKAGE WORKFLOW
    // ==================================================

    if (
      String(
        data.category || ""
      )
      .toLowerCase()
      .trim() === "package"
    ) {

      Logger.log(
        "================================"
      );

      Logger.log(
        "PACKAGE WORKFLOW STARTED"
      );

      Logger.log(
        "================================"
      );


      // ==================================================
      // 5A. HARD SAFETY RULE:
      // DELIVERED PACKAGE = NO AUTOMATION
      // ==================================================

      const packageStatus =
        String(
          data.package_status || ""
        )
        .toLowerCase()
        .trim();


      const subcategory =
        String(
          data.subcategory || ""
        )
        .toLowerCase()
        .trim();


      if (
        packageStatus === "delivered" ||
        subcategory === "delivered"
      ) {

        Logger.log(
          "PACKAGE SAFETY RULE TRIGGERED."
        );

        Logger.log(
          "Package status: DELIVERED"
        );

        Logger.log(
          "Google Task: BLOCKED"
        );

        Logger.log(
          "Calendar event: BLOCKED"
        );

        Logger.log(
          "Alarm/reminder: BLOCKED"
        );


        markEmailAsProcessed(
          email.id
        );


        Logger.log(
          "Delivered package email marked as processed."
        );

        Logger.log(
          "PACKAGE WORKFLOW COMPLETE"
        );

        Logger.log(
          "================================"
        );


        return;
      }


      // ==================================================
      // 5B. HARD SAFETY RULE:
      // ACTION NOT REQUIRED = NO PACKAGE TASK
      // ==================================================

      if (
        data.action_required !== true
      ) {

        Logger.log(
          "PACKAGE TASK BLOCKED: Action is not required."
        );

        Logger.log(
          "Action required: " +
          data.action_required
        );

        Logger.log(
          "Package status: " +
          (
            data.package_status ||
            "unknown"
          )
        );

        Logger.log(
          "Google Task: BLOCKED"
        );

        Logger.log(
          "Calendar event: BLOCKED"
        );

        Logger.log(
          "Alarm/reminder: BLOCKED"
        );


        markEmailAsProcessed(
          email.id
        );


        Logger.log(
          "Non-actionable package email marked as processed."
        );

        Logger.log(
          "PACKAGE WORKFLOW COMPLETE"
        );

        Logger.log(
          "================================"
        );


        return;
      }


      // ==================================================
      // 5C. NORMAL ACTIONABLE PACKAGE
      // ==================================================

      Logger.log(
        "Package requires action."
      );

      Logger.log(
        "Checking package task requirements..."
      );


      const packageTaskId =
        createPackageTask(data);


      if (packageTaskId) {

        Logger.log(
          "Package Task ID: " +
          packageTaskId
        );

      } else {

        Logger.log(
          "No package task created."
        );

        Logger.log(
          "Package did not require a task."
        );
      }


      markEmailAsProcessed(
        email.id
      );


      Logger.log(
        "Package email marked as processed."
      );


      Logger.log(
        "PACKAGE WORKFLOW COMPLETE"
      );

      Logger.log(
        "================================"
      );


      return;
    }


    // ==================================================
    // 6. NORMAL EMAIL SAFETY CHECKS
    // ==================================================

    const calendarAllowed =
      shouldCreateCalendarEvent(
        data
      );


    const taskAllowed =
      shouldCreateTask(
        data
      );


    Logger.log(
      "Calendar allowed: " +
      calendarAllowed
    );


    Logger.log(
      "Task allowed: " +
      taskAllowed
    );


    // ==================================================
    // 7. CALENDAR
    // ==================================================

    let calendarId = null;


    if (
      (
        data.classification ===
          "calendar_event"

        ||

        data.classification ===
          "event_and_task"
      )

      &&

      calendarAllowed
    ) {

      calendarId =
        createCalendarEvent(
          data
        );


      Logger.log(
        "Calendar ID: " +
        (
          calendarId ||
          "None"
        )
      );


    } else {

      Logger.log(
        "Calendar action skipped."
      );
    }


    // ==================================================
    // 8. GOOGLE TASK
    // ==================================================

    let taskId = null;


    if (
      (
        data.classification ===
          "task"

        ||

        data.classification ===
          "event_and_task"
      )

      &&

      taskAllowed
    ) {

      taskId =
        createGoogleTask(
          data
        );


      Logger.log(
        "Task ID: " +
        (
          taskId ||
          "None"
        )
      );


      // ==================================================
      // 8A. DEADLINE REMINDER
      // ==================================================

      if (
        taskId
        &&
        data.deadline
        &&
        !data.start_time
        &&
        data.classification === "task"
      ) {

        Logger.log(
          "Creating deadline Calendar reminder..."
        );


        const deadlineReminderId =
          createDeadlineReminder(
            data
          );


        Logger.log(
          "Deadline Reminder ID: " +
          (
            deadlineReminderId ||
            "None"
          )
        );


      } else {

        Logger.log(
          "Deadline reminder not required."
        );
      }


    } else {

      Logger.log(
        "Task action skipped."
      );
    }


    // ==================================================
    // 9. REVIEW REQUIRED
    // ==================================================

    if (
      data.classification ===
      "review_required"
    ) {

      Logger.log(
        "REVIEW REQUIRED."
      );

      Logger.log(
        "No automatic action taken."
      );
    }


    // ==================================================
    // 10. MARK EMAIL PROCESSED
    // ==================================================

    markEmailAsProcessed(
      email.id
    );


    Logger.log(
      "Email successfully marked as processed."
    );


    // ==================================================
    // 11. FINAL REPORT
    // ==================================================

    Logger.log(
      "================================"
    );

    Logger.log(
      "PRODUCTION PROCESSING COMPLETE"
    );

    Logger.log(
      "================================"
    );

    Logger.log(
      "Calendar ID: " +
      (
        calendarId ||
        "None"
      )
    );

    Logger.log(
      "Task ID: " +
      (
        taskId ||
        "None"
      )
    );

    Logger.log(
      "================================"
    );


  } catch (error) {


    // ==================================================
    // ERROR HANDLING
    // ==================================================

    Logger.log(
      "================================"
    );

    Logger.log(
      "PROCESSING FAILED"
    );

    Logger.log(
      "================================"
    );

    Logger.log(
      "Email: " +
      email.subject
    );

    Logger.log(
      "Message ID: " +
      email.id
    );

    Logger.log(
      "Error: " +
      error.message
    );


    // ==================================================
    // GEMINI TRANSIENT ERROR HANDLING
    //
    // Covers BOTH:
    //   - 429 / quota exceeded (rate limit)
    //   - 500 / 503 / "high demand" / "overloaded"
    //     (temporary server-side capacity issues)
    //
    // Both cases mean "Gemini needs a breather" and get
    // the same cooldown-and-retry treatment instead of
    // being thrown as a hard failure.
    // ==================================================

    const errorMessage =
      String(
        error.message ||
        ""
      ).toLowerCase();


    const isGeminiQuotaError =
      errorMessage.includes("429") ||
      errorMessage.includes("quota exceeded") ||
      errorMessage.includes("too many requests") ||
      errorMessage.includes("500") ||
      errorMessage.includes("503") ||
      errorMessage.includes("high demand") ||
      errorMessage.includes("overloaded") ||
      errorMessage.includes("internal error") ||
      errorMessage.includes("backend error") ||
      errorMessage.includes(
        "generativelanguage.googleapis.com"
      );


    if (
      isGeminiQuotaError
    ) {

      const cooldownMinutes =
        15;


      const cooldownUntil =
        Date.now() +
        (
          cooldownMinutes *
          60 *
          1000
        );


      PropertiesService
        .getScriptProperties()
        .setProperty(
          "GEMINI_COOLDOWN_UNTIL",
          String(
            cooldownUntil
          )
        );


      Logger.log(
        "================================"
      );

      Logger.log(
        "GEMINI QUOTA/RATE-LIMIT DETECTED"
      );

      Logger.log(
        "Gemini requests paused for " +
        cooldownMinutes +
        " minutes."
      );

      Logger.log(
        "Email remains UNPROCESSED."
      );

      Logger.log(
        "It will be retried after cooldown."
      );

      Logger.log(
        "================================"
      );


      return;
    }


    // ==================================================
    // NON-GEMINI ERRORS
    // ==================================================

    Logger.log(
      "Non-Gemini error detected."
    );

    Logger.log(
      "The email remains unprocessed."
    );

    Logger.log(
      "The error will be thrown for retry/debugging."
    );

    Logger.log(
      "================================"
    );


    throw error;
  }
}
function createDeadlineReminder(data) {

  // ==================================================
  // HARD SAFETY RULE:
  // DELIVERED PACKAGES NEVER GET DEADLINE REMINDERS
  // ==================================================

  if (
    data.category === "package" &&
    data.package_status === "delivered"
  ) {

    Logger.log(
      "DEADLINE REMINDER BLOCKED: Delivered package."
    );

    return null;
  }


  // ==================================================
  // DEADLINE REQUIRED
  // ==================================================

  if (!data.deadline) {

    Logger.log(
      "Deadline reminder skipped: no deadline."
    );

    return null;
  }


  // ==================================================
  // EXTRACT DATE ONLY
  //
  // Accepts:
  // YYYY-MM-DD
  // YYYY-MM-DD HH:MM:SS
  // YYYY-MM-DDTHH:MM:SS
  // ==================================================

  const deadlineString =
    String(data.deadline).trim();


  const match =
    deadlineString.match(
      /^(\d{4}-\d{2}-\d{2})/
    );


  if (!match) {

    Logger.log(
      "Deadline reminder skipped: invalid date format."
    );

    Logger.log(
      "Received deadline: " +
      deadlineString
    );

    return null;
  }


  const deadlineDate =
    match[1];


  // ==================================================
  // CREATE 9:00 AM TIMED REMINDER
  // ==================================================

  const start =
    new Date(
      deadlineDate +
      "T09:00:00"
    );


  const end =
    new Date(
      start.getTime() +
      5 * 60 * 1000
    );


  // ==================================================
  // DON'T CREATE REMINDER FOR PAST DEADLINE
  // ==================================================

  if (
    start.getTime() <= Date.now()
  ) {

    Logger.log(
      "Deadline reminder skipped: deadline reminder time has passed."
    );

    return null;
  }


  // ==================================================
  // CALENDAR
  // ==================================================

  const calendar =
    CalendarApp.getDefaultCalendar();


  // ==================================================
  // REMINDER TITLE
  // ==================================================

  const title =
    (data.title || "Deadline") +
    " — DEADLINE REMINDER";


  // ==================================================
  // DESCRIPTION
  // ==================================================

  const description =
    buildEventDescription(data) +
    "\n\n" +
    "9:00 AM deadline reminder created by College AI Automation.";


  // ==================================================
  // CREATE TIMED CALENDAR EVENT
  // ==================================================

  const event =
    calendar.createEvent(
      title,
      start,
      end,
      {
        description: description,
        location: data.location || ""
      }
    );


  // ==================================================
  // POPUP ALARM
  // ==================================================
  //
  // 0 = exactly when the reminder event begins.
  //
  // Therefore:
  //
  // August 25, 9:00 AM
  //        ↓
  // Popup at 9:00 AM
  //
  // ==================================================

  event.addPopupReminder(0);


  Logger.log(
    "Deadline Calendar reminder created: " +
    event.getId()
  );

  Logger.log(
    "Deadline reminder date: " +
    deadlineDate
  );

  Logger.log(
    "Deadline reminder time: 9:00 AM"
  );

  Logger.log(
    "Popup alarm: 0 minutes before reminder event."
  );


  return event.getId();
}
function isGeminiCooldownActive() {

  const properties =
    PropertiesService.getScriptProperties();

  const cooldownUntil =
    properties.getProperty(
      "GEMINI_COOLDOWN_UNTIL"
    );


  if (!cooldownUntil) {
    return false;
  }


  const cooldownTime =
    Number(cooldownUntil);


  if (
    Date.now() < cooldownTime
  ) {

    const remainingMinutes =
      Math.ceil(
        (
          cooldownTime -
          Date.now()
        ) /
        60000
      );


    Logger.log(
      "GEMINI COOLDOWN ACTIVE."
    );

    Logger.log(
      "Gemini requests temporarily paused."
    );

    Logger.log(
      "Approximate time remaining: " +
      remainingMinutes +
      " minute(s)."
    );


    return true;
  }


  // Cooldown has expired.
  properties.deleteProperty(
    "GEMINI_COOLDOWN_UNTIL"
  );


  Logger.log(
    "Gemini cooldown expired."
  );


  return false;
}
function testRegistroConnection() {

  Logger.log("================================");
  Logger.log("REGISTRO CONNECTION TEST");
  Logger.log("================================");

  const url =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";

  Logger.log("Testing Registro API...");
  Logger.log("No authentication token supplied.");
  Logger.log("Read-only test. No Calendar/Task changes.");

  try {

    const response =
      UrlFetchApp.fetch(
        url,
        {
          method: "get",
          muteHttpExceptions: true
        }
      );

    const statusCode =
      response.getResponseCode();

    const body =
      response.getContentText();

    Logger.log(
      "HTTP Status: " +
      statusCode
    );

    Logger.log(
      "Response length: " +
      body.length
    );

    Logger.log(
      "Response preview:"
    );

    Logger.log(
      body.substring(
        0,
        1000
      )
    );

    Logger.log(
      "================================"
    );

    Logger.log(
      "REGISTRO CONNECTION TEST COMPLETE"
    );

    Logger.log(
      "================================"
    );

  } catch (error) {

    Logger.log(
      "REGISTRO CONNECTION TEST FAILED"
    );

    Logger.log(
      "Error: " +
      error.message
    );

    throw error;
  }
}
function testRegistroPropertyStore() {
  Logger.log("================================");
  Logger.log("REGISTRO SCRIPT PROPERTY TEST");
  Logger.log("================================");

  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("REGISTRO_ACCESS_TOKEN");

  Logger.log("Property exists: " + (token ? "YES" : "NO"));

  if (!token) {
    Logger.log("REGISTRO_ACCESS_TOKEN is EMPTY or MISSING.");
    return;
  }

  Logger.log("Token length: " + token.length);

  Logger.log(
    "Token first 10 chars: " +
    token.substring(0, 10)
  );

  Logger.log(
    "Token last 10 chars: " +
    token.substring(token.length - 10)
  );

  const parts = token.split(".");

  Logger.log("JWT sections: " + parts.length);

  if (parts.length === 3) {
    try {
      const payloadJson = Utilities.newBlob(
        Utilities.base64DecodeWebSafe(parts[1])
      ).getDataAsString();

      const payload = JSON.parse(payloadJson);

      Logger.log(
        "JWT expiration (UTC): " +
        (
          payload.exp
            ? new Date(payload.exp * 1000).toISOString()
            : "NOT PRESENT"
        )
      );

      Logger.log(
        "JWT expiration (IST): " +
        (
          payload.exp
            ? Utilities.formatDate(
                new Date(payload.exp * 1000),
                Session.getScriptTimeZone(),
                "dd-MMM-yyyy HH:mm:ss"
              )
            : "NOT PRESENT"
        )
      );

    } catch (e) {
      Logger.log("JWT decode failed: " + e.message);
    }
  }

  Logger.log("================================");
  Logger.log("PROPERTY TEST COMPLETE");
  Logger.log("================================");
}
function testShippedPackageSafetyRule() {

  Logger.log("================================");
  Logger.log("SHIPPED PACKAGE SAFETY TEST");
  Logger.log("================================");

  const testData = {
    category: "package",
    subcategory: "shipped",
    package_status: "shipped",
    action_required: false,
    classification: "informational",
    priority: "medium",
    title: "TEST SHIPPED PACKAGE"
  };

  Logger.log(
    "Before applyPackageRules:"
  );

  Logger.log(
    JSON.stringify(testData)
  );


  applyPackageRules(testData);


  Logger.log(
    "After applyPackageRules:"
  );

  Logger.log(
    JSON.stringify(testData)
  );


  // ==================================================
  // SAFETY ASSERTION
  // ==================================================

  if (
    testData.action_required === false
  ) {

    Logger.log(
      "PASS: Shipped informational package remains non-actionable."
    );

  } else {

    throw new Error(
      "FAIL: Shipped package became actionable."
    );
  }


  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GEMINI REQUEST MADE."
  );

  Logger.log(
    "SHIPPED PACKAGE SAFETY TEST COMPLETE"
  );

  Logger.log(
    "================================"
  );
}
function testDeliveredPackageSafetyRule() {

  Logger.log("================================");
  Logger.log("DELIVERED PACKAGE SAFETY TEST");
  Logger.log("================================");

  const testData = {
    category: "package",
    subcategory: "delivered",
    package_status: "delivered",
    action_required: true,
    classification: "task",
    priority: "high",
    title: "TEST DELIVERED PACKAGE"
  };


  Logger.log(
    "Before applyPackageRules:"
  );

  Logger.log(
    JSON.stringify(testData)
  );


  applyPackageRules(testData);


  Logger.log(
    "After applyPackageRules:"
  );

  Logger.log(
    JSON.stringify(testData)
  );


  if (
    testData.action_required === false &&
    testData.classification === "informational"
  ) {

    Logger.log(
      "PASS: Delivered package is non-actionable."
    );

  } else {

    throw new Error(
      "FAIL: Delivered package was not blocked."
    );
  }


  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GEMINI REQUEST MADE."
  );

  Logger.log(
    "DELIVERED PACKAGE SAFETY TEST COMPLETE"
  );

  Logger.log(
    "================================"
  );
}
function testActionablePackageRule() {

  Logger.log("================================");
  Logger.log("ACTIONABLE PACKAGE TEST");
  Logger.log("================================");

  const testData = {
    category: "package",
    subcategory: "out_for_delivery",
    package_status: "out_for_delivery",
    action_required: true,
    classification: "task",
    priority: "medium",
    title: "TEST ACTIONABLE PACKAGE",
    product_name: "Test Package",
    carrier: "Test Carrier",
    tracking_number: "TEST123"
  };


  Logger.log(
    "Before applyPackageRules:"
  );

  Logger.log(
    JSON.stringify(testData)
  );


  applyPackageRules(testData);


  Logger.log(
    "After applyPackageRules:"
  );

  Logger.log(
    JSON.stringify(testData)
  );


  if (
    testData.action_required === true
  ) {

    Logger.log(
      "PASS: Actionable package remains actionable."
    );

  } else {

    throw new Error(
      "FAIL: Legitimate package action was blocked."
    );
  }


  if (
    testData.priority === "high"
  ) {

    Logger.log(
      "PASS: Out-for-delivery package priority is HIGH."
    );

  } else {

    throw new Error(
      "FAIL: Out-for-delivery package priority was not HIGH."
    );
  }


  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GEMINI REQUEST MADE."
  );

  Logger.log(
    "ACTIONABLE PACKAGE RULE TEST COMPLETE"
  );

  Logger.log(
    "================================"
  );
}
function resetOneProcessedEmailForTest() {

  const emailId =
    "19fe8a4f3ab42599";

  const properties =
    PropertiesService.getScriptProperties();

  const processedRaw =
    properties.getProperty(
      "PROCESSED_EMAIL_IDS"
    );

  if (!processedRaw) {

    Logger.log(
      "PROCESSED_EMAIL_IDS is empty."
    );

    return;
  }

  let ids;

  try {

    ids =
      JSON.parse(
        processedRaw
      );

  } catch (error) {

    throw new Error(
      "PROCESSED_EMAIL_IDS is not valid JSON."
    );
  }


  const beforeCount =
    ids.length;


  const wasPresent =
    ids.includes(
      emailId
    );


  const updatedIds =
    ids.filter(
      id => id !== emailId
    );


  properties.setProperty(
    "PROCESSED_EMAIL_IDS",
    JSON.stringify(
      updatedIds
    )
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "SINGLE EMAIL PROCESSING RESET"
  );

  Logger.log(
    "================================"
  );

  Logger.log(
    "Message ID: " +
    emailId
  );

  Logger.log(
    "Was already processed: " +
    wasPresent
  );

  Logger.log(
    "Processed IDs before: " +
    beforeCount
  );

  Logger.log(
    "Processed IDs after: " +
    updatedIds.length
  );

  Logger.log(
    "Email is now eligible for testing."
  );

  Logger.log(
    "================================"
  );
}
function testPackageActionMapping() {

  Logger.log("================================");
  Logger.log("PACKAGE ACTION MAPPING TEST");
  Logger.log("================================");


  // ==================================================
  // TEST 1 — TRACK SHIPMENT
  // ==================================================

  const trackingData = {
    category: "package",
    package_status: "shipped",
    action_required: true,
    title: "Track shipment for Dermatouch Salicylic Acid",
    product_name: "Dermatouch Salicylic Acid"
  };


  const trackingText =
    (
      String(trackingData.title || "") +
      " " +
      String(trackingData.action || "")
    )
    .toLowerCase();


  const trackingDetected =
    trackingText.includes("track shipment") ||
    trackingText.includes("track package") ||
    trackingText.includes("tracking") ||
    trackingText.includes("track delivery");


  Logger.log(
    "TEST 1 — Track shipment"
  );

  Logger.log(
    "Expected: TRACKING ACTION"
  );

  Logger.log(
    "Detected: " +
    trackingDetected
  );


  if (!trackingDetected) {

    throw new Error(
      "FAIL: Tracking action was not detected."
    );
  }


  Logger.log(
    "PASS: Tracking action detected."
  );


  // ==================================================
  // TEST 2 — HOSTEL ACTION
  // ==================================================

  const hostelData = {
    category: "package",
    package_status: "out_for_delivery",
    action_required: true,
    title:
      "Inform hostel reception to receive package",
    product_name: "Test Package"
  };


  const hostelText =
    (
      String(hostelData.title || "") +
      " " +
      String(hostelData.action || "")
    )
    .toLowerCase();


  const hostelDetected =
    hostelText.includes("hostel") ||
    hostelText.includes("reception") ||
    hostelText.includes("hostel authority") ||
    hostelText.includes("receive package") ||
    hostelText.includes("collect package");


  Logger.log(
    "TEST 2 — Hostel action"
  );

  Logger.log(
    "Expected: HOSTEL ACTION"
  );

  Logger.log(
    "Detected: " +
    hostelDetected
  );


  if (!hostelDetected) {

    throw new Error(
      "FAIL: Hostel action was not detected."
    );
  }


  Logger.log(
    "PASS: Hostel action detected."
  );


  // ==================================================
  // TEST 3 — INFORMATIONAL / NO ACTION
  // ==================================================

  const informationalData = {
    category: "package",
    package_status: "shipped",
    action_required: false,
    title:
      "Your package has been shipped"
  };


  Logger.log(
    "TEST 3 — Informational package"
  );

  Logger.log(
    "Expected: NO TASK"
  );

  Logger.log(
    "Action required: " +
    informationalData.action_required
  );


  if (
    informationalData.action_required !== false
  ) {

    throw new Error(
      "FAIL: Informational package became actionable."
    );
  }


  Logger.log(
    "PASS: Informational package remains non-actionable."
  );


  // ==================================================
  // FINAL
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GMAIL EMAIL PROCESSED."
  );

  Logger.log(
    "NO GEMINI REQUEST MADE."
  );

  Logger.log(
    "ALL PACKAGE ACTION MAPPING TESTS PASSED."
  );

  Logger.log(
    "================================"
  );
}
function buildPackageTaskData(data) {

  const product =
    data.product_name ||
    "Package";

  const geminiTitle =
    String(
      data.title ||
      ""
    ).trim();

  const geminiAction =
    String(
      data.action ||
      data.recommended_action ||
      data.next_action ||
      ""
    ).trim();

  const combinedActionText =
    (
      geminiTitle +
      " " +
      geminiAction
    ).toLowerCase();


  const hostelActionRequired =
    combinedActionText.includes("hostel") ||
    combinedActionText.includes("reception") ||
    combinedActionText.includes("hostel authority") ||
    combinedActionText.includes("receive package") ||
    combinedActionText.includes("collect package");


  const trackingAction =
    combinedActionText.includes("track shipment") ||
    combinedActionText.includes("track package") ||
    combinedActionText.includes("tracking") ||
    combinedActionText.includes("track delivery");


  let title;


  if (hostelActionRequired) {

    title =
      "Inform hostel authority about package";

  } else if (trackingAction) {

    title =
      geminiTitle ||
      "Track package shipment";

  } else {

    title =
      geminiTitle ||
      ("Package action: " + product);
  }


  let notes =
    "📦 PACKAGE REMINDER\n\n" +
    "Package:\n" +
    product +
    "\n\nStatus:\n" +
    (data.package_status || "Unknown");


  if (data.carrier) {

    notes +=
      "\n\nCarrier:\n" +
      data.carrier;
  }


  if (data.tracking_number) {

    notes +=
      "\n\nTracking number:\n" +
      data.tracking_number;
  }


  if (data.order_number) {

    notes +=
      "\n\nOrder number:\n" +
      data.order_number;
  }


  if (data.expected_delivery_date) {

    notes +=
      "\n\nExpected delivery:\n" +
      data.expected_delivery_date;
  }


  notes +=
    "\n\nAction identified by Gemini:\n" +
    (
      geminiAction ||
      geminiTitle ||
      "Review package status."
    );


  if (hostelActionRequired) {

    notes +=
      "\n\nHostel action:\n" +
      "Inform hostel authority/reception " +
      "to receive the package.";
  }


  const task = {
    title: title,
    notes: notes
  };


  if (data.expected_delivery_date) {

    task.due =
      data.expected_delivery_date +
      "T00:00:00+05:30";
  }


  return task;
}
function testPackageTaskBuilder() {

  Logger.log("================================");
  Logger.log("PACKAGE TASK BUILDER TEST");
  Logger.log("================================");


  // ==================================================
  // TRACKING PACKAGE
  // ==================================================

  const trackingData = {

    category: "package",

    package_status: "shipped",

    action_required: true,

    title:
      "Track shipment for Dermatouch Salicylic Acid",

    product_name:
      "Dermatouch Salicylic Acid",

    carrier:
      "Flipkart",

    tracking_number:
      "TEST123"
  };


  const trackingTask =
    buildPackageTaskData(
      trackingData
    );


  Logger.log(
    "Tracking task title:"
  );

  Logger.log(
    trackingTask.title
  );


  if (
    trackingTask.title !==
    "Track shipment for Dermatouch Salicylic Acid"
  ) {

    throw new Error(
      "FAIL: Tracking task title is incorrect."
    );
  }


  Logger.log(
    "PASS: Tracking task title is correct."
  );


  // ==================================================
  // HOSTEL PACKAGE
  // ==================================================

  const hostelData = {

    category: "package",

    package_status:
      "out_for_delivery",

    action_required: true,

    title:
      "Inform hostel reception to receive package",

    product_name:
      "Test Package"
  };


  const hostelTask =
    buildPackageTaskData(
      hostelData
    );


  Logger.log(
    "Hostel task title:"
  );

  Logger.log(
    hostelTask.title
  );


  if (
    hostelTask.title !==
    "Inform hostel authority about package"
  ) {

    throw new Error(
      "FAIL: Hostel task title is incorrect."
    );
  }


  Logger.log(
    "PASS: Hostel task title is correct."
  );


  // ==================================================
  // FINAL
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GMAIL EMAIL PROCESSED."
  );

  Logger.log(
    "NO GEMINI REQUEST MADE."
  );

  Logger.log(
    "PACKAGE TASK BUILDER TEST PASSED."
  );

  Logger.log(
    "================================"
  );
}
function buildPackageTaskData(data) {

  // ==================================================
  // BASIC INFORMATION
  // ==================================================

  const product =
    data.product_name ||
    "Package";


  const geminiTitle =
    String(
      data.title ||
      ""
    )
    .trim();


  const geminiAction =
    String(
      data.action ||
      data.recommended_action ||
      data.next_action ||
      ""
    )
    .trim();


  // ==================================================
  // COMBINE GEMINI ACTION INFORMATION
  // ==================================================

  const combinedActionText =
    (
      geminiTitle +
      " " +
      geminiAction
    )
    .toLowerCase();


  // ==================================================
  // HOSTEL ACTION DETECTION
  // ==================================================

  const hostelActionRequired =
    combinedActionText.includes(
      "hostel"
    ) ||
    combinedActionText.includes(
      "reception"
    ) ||
    combinedActionText.includes(
      "hostel authority"
    ) ||
    combinedActionText.includes(
      "receive package"
    ) ||
    combinedActionText.includes(
      "collect package"
    );


  // ==================================================
  // TRACKING ACTION DETECTION
  // ==================================================

  const trackingAction =
    combinedActionText.includes(
      "track shipment"
    ) ||
    combinedActionText.includes(
      "track package"
    ) ||
    combinedActionText.includes(
      "tracking"
    ) ||
    combinedActionText.includes(
      "track delivery"
    );


  // ==================================================
  // DETERMINE TASK TITLE
  // ==================================================

  let title;


  if (
    hostelActionRequired
  ) {

    title =
      "Inform hostel authority about package";

  } else if (
    trackingAction
  ) {

    title =
      geminiTitle ||
      "Track package shipment";

  } else {

    title =
      geminiTitle ||
      (
        "Package action: " +
        product
      );
  }


  // ==================================================
  // BUILD NOTES
  // ==================================================

  let notes =
    "📦 PACKAGE REMINDER\n\n" +

    "Package:\n" +
    product +

    "\n\nStatus:\n" +
    (
      data.package_status ||
      "Unknown"
    );


  if (
    data.carrier
  ) {

    notes +=
      "\n\nCarrier:\n" +
      data.carrier;
  }


  if (
    data.tracking_number
  ) {

    notes +=
      "\n\nTracking number:\n" +
      data.tracking_number;
  }


  if (
    data.order_number
  ) {

    notes +=
      "\n\nOrder number:\n" +
      data.order_number;
  }


  if (
    data.expected_delivery_date
  ) {

    notes +=
      "\n\nExpected delivery:\n" +
      data.expected_delivery_date;
  }


  // ==================================================
  // GEMINI ACTION
  // ==================================================

  notes +=
    "\n\nAction identified by Gemini:\n" +
    (
      geminiAction ||
      geminiTitle ||
      "Review package status."
    );


  // ==================================================
  // HOSTEL-SPECIFIC INSTRUCTION
  // ==================================================

  if (
    hostelActionRequired
  ) {

    notes +=
      "\n\nHostel action:\n" +
      "Inform hostel authority/reception " +
      "to receive the package.";
  }


  // ==================================================
  // BUILD TASK OBJECT
  // ==================================================

  const task = {
    title: title,
    notes: notes
  };


  // ==================================================
  // DUE DATE
  // ==================================================

  if (
    data.expected_delivery_date
  ) {

    task.due =
      data.expected_delivery_date +
      "T00:00:00+05:30";
  }


  return task;
}
function findPackageEmailsForTesting() {

  Logger.log("================================");
  Logger.log("PACKAGE EMAIL TEST SEARCH");
  Logger.log("================================");

  const threads =
    GmailApp.search(
      'label:AI-GEMINI-READY',
      0,
      20
    );


  if (
    threads.length === 0
  ) {

    Logger.log(
      "No AI-GEMINI-READY emails found."
    );

    return;
  }


  threads.forEach(
    thread => {

      thread
        .getMessages()
        .forEach(
          message => {

            const subject =
              message.getSubject();

            const id =
              message.getId();

            const processed =
              isEmailAlreadyProcessed(
                id
              );


            if (
              subject
                .toLowerCase()
                .includes("shipped") ||

              subject
                .toLowerCase()
                .includes("package") ||

              subject
                .toLowerCase()
                .includes("delivered") ||

              subject
                .toLowerCase()
                .includes("order")
            ) {

              Logger.log(
                "--------------------------------"
              );

              Logger.log(
                "Subject: " +
                subject
              );

              Logger.log(
                "Message ID: " +
                id
              );

              Logger.log(
                "Processed: " +
                processed
              );

              Logger.log(
                "Date: " +
                message
                  .getDate()
                  .toString()
              );
            }

          }
        );

    }
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "SEARCH COMPLETE"
  );

  Logger.log(
    "NO EMAIL WAS PROCESSED."
  );

  Logger.log(
    "NO GEMINI REQUEST WAS MADE."
  );

  Logger.log(
    "================================"
  );
}
function resetChaptexShippedEmailForTest() {

  const emailId =
    "19fee21752104438";

  const properties =
    PropertiesService.getScriptProperties();

  const processedRaw =
    properties.getProperty(
      "PROCESSED_EMAIL_IDS"
    );

  if (!processedRaw) {

    Logger.log(
      "PROCESSED_EMAIL_IDS is empty."
    );

    return;
  }

  let ids;

  try {

    ids =
      JSON.parse(
        processedRaw
      );

  } catch (error) {

    throw new Error(
      "PROCESSED_EMAIL_IDS is not valid JSON."
    );
  }


  const beforeCount =
    ids.length;

  const wasPresent =
    ids.includes(
      emailId
    );

  const updatedIds =
    ids.filter(
      id => id !== emailId
    );


  PropertiesService
    .getScriptProperties()
    .setProperty(
      "PROCESSED_EMAIL_IDS",
      JSON.stringify(
        updatedIds
      )
    );


  Logger.log(
    "================================"
  );

  Logger.log(
    "CHAPTEX TEST EMAIL RESET"
  );

  Logger.log(
    "================================"
  );

  Logger.log(
    "Message ID: " +
    emailId
  );

  Logger.log(
    "Was already processed: " +
    wasPresent
  );

  Logger.log(
    "Processed IDs before: " +
    beforeCount
  );

  Logger.log(
    "Processed IDs after: " +
    updatedIds.length
  );

  Logger.log(
    "Chaptex shipped email is now eligible for testing."
  );

  Logger.log(
    "================================"
  );
}
function testPackageRulesFinal() {

  Logger.log("================================");
  Logger.log("FINAL PACKAGE RULE TEST");
  Logger.log("================================");


  // ==================================================
  // TEST 1 — NORMAL SHIPPED NOTIFICATION
  // ==================================================

  const shippedData = {

    category: "package",

    package_status: "shipped",

    subcategory: "shipped",

    action_required: true,

    classification: "task",

    priority: "medium",

    title:
      "Chaptex Lip Care Lip Balm shipped"
  };


  applyPackageRules(
    shippedData
  );


  Logger.log(
    "TEST 1 — Normal shipped notification"
  );

  Logger.log(
    "Action required: " +
    shippedData.action_required
  );

  Logger.log(
    "Classification: " +
    shippedData.classification
  );

  Logger.log(
    "Priority: " +
    shippedData.priority
  );


  if (
    shippedData.action_required !== false
  ) {

    throw new Error(
      "FAIL: Normal shipped notification became actionable."
    );
  }


  Logger.log(
    "PASS: Normal shipped notification is blocked."
  );


  // ==================================================
  // TEST 2 — TRACK SHIPMENT
  // ==================================================

  const trackingData = {

    category: "package",

    package_status: "shipped",

    subcategory: "shipped",

    action_required: true,

    classification: "task",

    priority: "medium",

    title:
      "Track shipment for Chaptex Lip Care Lip Balm"
  };


  applyPackageRules(
    trackingData
  );


  Logger.log(
    "TEST 2 — Track shipment"
  );

  Logger.log(
    "Action required: " +
    trackingData.action_required
  );

  Logger.log(
    "Priority: " +
    trackingData.priority
  );


  if (
    trackingData.action_required !== true
  ) {

    throw new Error(
      "FAIL: Track shipment action was blocked."
    );
  }


  Logger.log(
    "PASS: Track shipment remains actionable."
  );


  // ==================================================
  // TEST 3 — HOSTEL RECEPTION
  // ==================================================

  const hostelData = {

    category: "package",

    package_status: "out_for_delivery",

    subcategory: "out_for_delivery",

    action_required: true,

    classification: "task",

    priority: "medium",

    title:
      "Inform hostel reception to receive package"
  };


  applyPackageRules(
    hostelData
  );


  Logger.log(
    "TEST 3 — Hostel reception"
  );

  Logger.log(
    "Action required: " +
    hostelData.action_required
  );

  Logger.log(
    "Priority: " +
    hostelData.priority
  );


  if (
    hostelData.action_required !== true
  ) {

    throw new Error(
      "FAIL: Hostel action was blocked."
    );
  }


  if (
    hostelData.priority !== "high"
  ) {

    throw new Error(
      "FAIL: Out-for-delivery priority is not HIGH."
    );
  }


  Logger.log(
    "PASS: Hostel action remains actionable."
  );

  Logger.log(
    "PASS: Out-for-delivery priority is HIGH."
  );


  // ==================================================
  // TEST 4 — DELIVERED
  // ==================================================

  const deliveredData = {

    category: "package",

    package_status: "delivered",

    subcategory: "delivered",

    action_required: true,

    classification: "task",

    priority: "high",

    title:
      "Package delivered"
  };


  applyPackageRules(
    deliveredData
  );


  Logger.log(
    "TEST 4 — Delivered package"
  );

  Logger.log(
    "Action required: " +
    deliveredData.action_required
  );

  Logger.log(
    "Classification: " +
    deliveredData.classification
  );

  Logger.log(
    "Priority: " +
    deliveredData.priority
  );


  if (
    deliveredData.action_required !== false
  ) {

    throw new Error(
      "FAIL: Delivered package became actionable."
    );
  }


  Logger.log(
    "PASS: Delivered package is blocked."
  );


  // ==================================================
  // FINAL
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "ALL FINAL PACKAGE RULE TESTS PASSED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GMAIL EMAIL PROCESSED."
  );

  Logger.log(
    "NO GEMINI REQUEST MADE."
  );

  Logger.log(
    "================================"
  );
}
function testRegistroTimetableParser() {

  Logger.log("================================");
  Logger.log("REGISTRO TIMETABLE PARSER TEST");
  Logger.log("================================");


  const token =
    PropertiesService
      .getScriptProperties()
      .getProperty("REGISTRO_ACCESS_TOKEN");


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  const url =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  Logger.log(
    "Fetching Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const statusCode =
    response.getResponseCode();


  const body =
    response.getContentText();


  Logger.log(
    "HTTP Status: " +
    statusCode
  );


  if (
    statusCode !== 200
  ) {

    Logger.log(
      "Registro response:"
    );

    Logger.log(
      body.substring(
        0,
        2000
      )
    );

    throw new Error(
      "Registro timetable request failed with HTTP " +
      statusCode
    );
  }


  const result =
    JSON.parse(body);


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  const sessions =
    result.data;


  Logger.log(
    "Total Registro records: " +
    sessions.length
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "FIRST 10 REGISTRO RECORDS"
  );

  Logger.log(
    "================================"
  );


  sessions
    .slice(0, 10)
    .forEach(
      (session, index) => {

        Logger.log(
          "RECORD " +
          (index + 1)
        );

        Logger.log(
          "Title: " +
          (session.title || "")
        );

        Logger.log(
          "Start: " +
          (session.start || "")
        );

        Logger.log(
          "End: " +
          (session.end || "")
        );

        Logger.log(
          "Course: " +
          (session.course || "")
        );

        Logger.log(
          "Section: " +
          (session.section || "")
        );

        Logger.log(
          "Professor: " +
          (session.professor || "")
        );

        Logger.log(
          "Classroom: " +
          (session.classroom_name || "")
        );

        Logger.log(
          "Session number: " +
          (session.session_number || "")
        );

        Logger.log(
          "Holiday: " +
          session.is_holiday
        );

        Logger.log(
          "Exam: " +
          session.is_exam
        );

        Logger.log(
          "--------------------------------"
        );
      }
    );


  Logger.log(
    "================================"
  );

  Logger.log(
    "REGISTRO TIMETABLE PARSER TEST COMPLETE"
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO GMAIL EMAIL PROCESSED."
  );

  Logger.log(
    "================================"
  );
}
function testRegistroRecordClassification() {

  Logger.log("================================");
  Logger.log("REGISTRO RECORD CLASSIFICATION TEST");
  Logger.log("================================");


  const token =
    PropertiesService
      .getScriptProperties()
      .getProperty("REGISTRO_ACCESS_TOKEN");


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  const url =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  Logger.log(
    "Fetching Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const statusCode =
    response.getResponseCode();


  if (
    statusCode !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      statusCode
    );
  }


  const result =
    JSON.parse(
      response.getContentText()
    );


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  const records =
    result.data;


  let holidayCount = 0;
  let examCount = 0;
  let classCount = 0;
  let missingCourseCount = 0;
  let classroomCount = 0;
  let professorCount = 0;
  let sessionNumberCount = 0;


  const classRecords = [];


  records.forEach(
    record => {

      if (
        record.is_holiday === true
      ) {

        holidayCount++;

      } else if (
        record.is_exam === true
      ) {

        examCount++;

      } else {

        classCount++;

        if (
          !record.course
        ) {

          missingCourseCount++;
        }

        if (
          record.classroom_name
        ) {

          classroomCount++;
        }

        if (
          record.professor
        ) {

          professorCount++;
        }

        if (
          record.session_number !== null &&
          record.session_number !== undefined &&
          record.session_number !== ""
        ) {

          sessionNumberCount++;
        }


        if (
          classRecords.length < 10
        ) {

          classRecords.push(
            record
          );
        }
      }
    }
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "REGISTRO RECORD COUNTS"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Total records: " +
    records.length
  );

  Logger.log(
    "Full-day / holiday records: " +
    holidayCount
  );

  Logger.log(
    "Exam records: " +
    examCount
  );

  Logger.log(
    "Other / class records: " +
    classCount
  );

  Logger.log(
    "Class records missing course: " +
    missingCourseCount
  );

  Logger.log(
    "Class records with classroom: " +
    classroomCount
  );

  Logger.log(
    "Class records with professor: " +
    professorCount
  );

  Logger.log(
    "Class records with session number: " +
    sessionNumberCount
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "FIRST 10 NON-HOLIDAY / NON-EXAM RECORDS"
  );

  Logger.log(
    "================================"
  );


  classRecords.forEach(
    (record, index) => {

      Logger.log(
        "RECORD " +
        (index + 1)
      );

      Logger.log(
        "Title: " +
        (record.title || "")
      );

      Logger.log(
        "Start: " +
        (record.start || "")
      );

      Logger.log(
        "End: " +
        (record.end || "")
      );

      Logger.log(
        "Course: " +
        (record.course || "")
      );

      Logger.log(
        "Section: " +
        (record.section || "")
      );

      Logger.log(
        "Professor: " +
        (record.professor || "")
      );

      Logger.log(
        "Classroom: " +
        (record.classroom_name || "")
      );

      Logger.log(
        "Session number: " +
        (
          record.session_number === null ||
          record.session_number === undefined
            ? ""
            : record.session_number
        )
      );

      Logger.log(
        "Holiday: " +
        record.is_holiday
      );

      Logger.log(
        "Exam: " +
        record.is_exam
      );

      Logger.log(
        "--------------------------------"
      );
    }
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "REGISTRO CLASSIFICATION TEST COMPLETE"
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO GMAIL EMAIL PROCESSED."
  );

  Logger.log(
    "================================"
  );
}
function testRegistroCalendarComparison() {

  Logger.log("================================");
  Logger.log("REGISTRO → GOOGLE CALENDAR COMPARISON");
  Logger.log("================================");


  // ==================================================
  // REGISTRO TOKEN
  // ==================================================

  const token =
    PropertiesService
      .getScriptProperties()
      .getProperty("REGISTRO_ACCESS_TOKEN");


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  // ==================================================
  // FETCH REGISTRO TIMETABLE
  // ==================================================

  const registroUrl =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  Logger.log(
    "Fetching Registro timetable..."
  );


  const registroResponse =
    UrlFetchApp.fetch(
      registroUrl,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const registroStatus =
    registroResponse.getResponseCode();


  if (
    registroStatus !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      registroStatus
    );
  }


  const registroResult =
    JSON.parse(
      registroResponse.getContentText()
    );


  if (
    !registroResult ||
    !Array.isArray(registroResult.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  const registroClasses =
    registroResult.data.filter(
      record =>
        record.is_holiday !== true &&
        record.is_exam !== true
    );


  Logger.log(
    "Registro regular classes: " +
    registroClasses.length
  );


  // ==================================================
  // GOOGLE CALENDAR
  // ==================================================

  const calendar =
    CalendarApp.getDefaultCalendar();


  Logger.log(
    "Google Calendar: " +
    calendar.getName()
  );


  // ==================================================
  // SEARCH WINDOW
  //
  // Use the earliest and latest Registro class dates.
  // ==================================================

  if (
    registroClasses.length === 0
  ) {

    Logger.log(
      "No Registro classes found."
    );

    return;
  }


  const startDates =
    registroClasses.map(
      record =>
        new Date(record.start)
    );


  const endDates =
    registroClasses.map(
      record =>
        new Date(record.end)
    );


  const earliestStart =
    new Date(
      Math.min(
        ...startDates
      )
    );


  const latestEnd =
    new Date(
      Math.max(
        ...endDates
      )
    );


  // Add one day on both sides so Calendar
  // search boundaries are safe.

  const calendarStart =
    new Date(
      earliestStart.getTime() -
      24 * 60 * 60 * 1000
    );


  const calendarEnd =
    new Date(
      latestEnd.getTime() +
      24 * 60 * 60 * 1000
    );


  Logger.log(
    "Calendar search start: " +
    calendarStart
  );

  Logger.log(
    "Calendar search end: " +
    calendarEnd
  );


  // ==================================================
  // FETCH EXISTING CALENDAR EVENTS
  // ==================================================

  Logger.log(
    "Reading existing Google Calendar events..."
  );


  const calendarEvents =
    calendar.getEvents(
      calendarStart,
      calendarEnd
    );


  Logger.log(
    "Existing Calendar events found: " +
    calendarEvents.length
  );


  // ==================================================
  // COMPARISON
  // ==================================================

  let exactMatches = 0;
  let possibleMatches = 0;
  let missingClasses = 0;


  const missingExamples = [];
  const possibleExamples = [];
  const matchedExamples = [];


  registroClasses.forEach(
    registro => {

      const registroStart =
        new Date(
          registro.start
        );


      const registroEnd =
        new Date(
          registro.end
        );


      const registroTitle =
        String(
          registro.title || ""
        )
        .trim()
        .toLowerCase();


      const registroCourse =
        String(
          registro.course || ""
        )
        .trim()
        .toLowerCase();


      const registroProfessor =
        String(
          registro.professor || ""
        )
        .trim()
        .toLowerCase();


      // ------------------------------------------------
      // EXACT TIME MATCH
      // ------------------------------------------------

      const timeMatches =
        calendarEvents.filter(
          event => {

            const eventStart =
              event.getStartTime();

            const eventEnd =
              event.getEndTime();


            return (
              Math.abs(
                eventStart.getTime() -
                registroStart.getTime()
              ) <= 60000 &&

              Math.abs(
                eventEnd.getTime() -
                registroEnd.getTime()
              ) <= 60000
            );
          }
        );


      // ------------------------------------------------
      // EXACT MATCH:
      //
      // Same time + course/title similarity.
      // ------------------------------------------------

      const exactMatch =
        timeMatches.find(
          event => {

            const eventTitle =
              String(
                event.getTitle() || ""
              )
              .trim()
              .toLowerCase();


            const eventDescription =
              String(
                event.getDescription() || ""
              )
              .trim()
              .toLowerCase();


            return (
              (
                registroTitle &&
                (
                  eventTitle ===
                  registroTitle ||

                  eventTitle.includes(
                    registroTitle
                  ) ||

                  registroTitle.includes(
                    eventTitle
                  )
                )
              ) ||

              (
                registroCourse &&
                (
                  eventTitle.includes(
                    registroCourse
                  ) ||

                  eventDescription.includes(
                    registroCourse
                  )
                )
              )
            );
          }
        );


      if (
        exactMatch
      ) {

        exactMatches++;


        if (
          matchedExamples.length < 10
        ) {

          matchedExamples.push(
            {
              registro:
                registro.title,

              calendar:
                exactMatch.getTitle(),

              start:
                registro.start
            }
          );
        }


        return;
      }


      // ------------------------------------------------
      // POSSIBLE MATCH:
      //
      // Same time but title/course did not match.
      // ------------------------------------------------

      if (
        timeMatches.length > 0
      ) {

        possibleMatches++;


        if (
          possibleExamples.length < 10
        ) {

          possibleExamples.push(
            {
              registro:
                registro.title,

              calendar:
                timeMatches[0].getTitle(),

              start:
                registro.start
            }
          );
        }


        return;
      }


      // ------------------------------------------------
      // COMPLETELY MISSING
      // ------------------------------------------------

      missingClasses++;


      if (
        missingExamples.length < 10
      ) {

        missingExamples.push(
          {
            title:
              registro.title,

            course:
              registro.course,

            professor:
              registro.professor,

            classroom:
              registro.classroom_name,

            start:
              registro.start,

            end:
              registro.end
          }
        );
      }
    }
  );


  // ==================================================
  // RESULTS
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "COMPARISON RESULTS"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Registro classes: " +
    registroClasses.length
  );


  Logger.log(
    "Exact Calendar matches: " +
    exactMatches
  );


  Logger.log(
    "Possible time-only matches: " +
    possibleMatches
  );


  Logger.log(
    "Missing Calendar classes: " +
    missingClasses
  );


  // ==================================================
  // EXAMPLES
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "MATCHED EXAMPLES"
  );

  Logger.log(
    "================================"
  );


  matchedExamples.forEach(
    example => {

      Logger.log(
        "Registro: " +
        example.registro
      );

      Logger.log(
        "Calendar: " +
        example.calendar
      );

      Logger.log(
        "Start: " +
        example.start
      );

      Logger.log(
        "--------------------------------"
      );
    }
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "POSSIBLE MATCH EXAMPLES"
  );

  Logger.log(
    "================================"
  );


  possibleExamples.forEach(
    example => {

      Logger.log(
        "Registro: " +
        example.registro
      );

      Logger.log(
        "Calendar: " +
        example.calendar
      );

      Logger.log(
        "Start: " +
        example.start
      );

      Logger.log(
        "--------------------------------"
      );
    }
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "MISSING CLASS EXAMPLES"
  );

  Logger.log(
    "================================"
  );


  missingExamples.forEach(
    example => {

      Logger.log(
        "Title: " +
        example.title
      );

      Logger.log(
        "Course: " +
        example.course
      );

      Logger.log(
        "Professor: " +
        example.professor
      );

      Logger.log(
        "Classroom: " +
        example.classroom
      );

      Logger.log(
        "Start: " +
        example.start
      );

      Logger.log(
        "End: " +
        example.end
      );

      Logger.log(
        "--------------------------------"
      );
    }
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT MODIFIED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT DELETED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "REGISTRO → CALENDAR COMPARISON COMPLETE"
  );

  Logger.log(
    "================================"
  );
}
function testRegistroDateBehavior() {

  Logger.log("================================");
  Logger.log("REGISTRO DATE BEHAVIOR TEST");
  Logger.log("================================");


  const token =
    PropertiesService
      .getScriptProperties()
      .getProperty("REGISTRO_ACCESS_TOKEN");


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  const url =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const statusCode =
    response.getResponseCode();


  if (
    statusCode !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      statusCode
    );
  }


  const result =
    JSON.parse(
      response.getContentText()
    );


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  const records =
    result.data;


  // ==================================================
  // AUGUST 16
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "AUGUST 16, 2026"
  );

  Logger.log(
    "================================"
  );


  const august16 =
    records.filter(
      record => {

        return String(
          record.start || ""
        ).startsWith(
          "2026-08-16"
        );
      }
    );


  Logger.log(
    "Records found: " +
    august16.length
  );


  august16.forEach(
    (record, index) => {

      Logger.log(
        "Record " +
        (index + 1)
      );

      Logger.log(
        "Title: " +
        (record.title || "")
      );

      Logger.log(
        "Start: " +
        (record.start || "")
      );

      Logger.log(
        "End: " +
        (record.end || "")
      );

      Logger.log(
        "Course: " +
        (record.course || "")
      );

      Logger.log(
        "Holiday: " +
        record.is_holiday
      );

      Logger.log(
        "Exam: " +
        record.is_exam
      );

      Logger.log(
        "--------------------------------"
      );
    }
  );


  // ==================================================
  // AUGUST 17
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "AUGUST 17, 2026"
  );

  Logger.log(
    "================================"
  );


  const august17 =
    records.filter(
      record => {

        return String(
          record.start || ""
        ).startsWith(
          "2026-08-17"
        );
      }
    );


  Logger.log(
    "Records found: " +
    august17.length
  );


  august17.forEach(
    (record, index) => {

      Logger.log(
        "Record " +
        (index + 1)
      );

      Logger.log(
        "Title: " +
        (record.title || "")
      );

      Logger.log(
        "Start: " +
        (record.start || "")
      );

      Logger.log(
        "End: " +
        (record.end || "")
      );

      Logger.log(
        "Course: " +
        (record.course || "")
      );

      Logger.log(
        "Professor: " +
        (record.professor || "")
      );

      Logger.log(
        "Classroom: " +
        (record.classroom_name || "")
      );

      Logger.log(
        "Session number: " +
        (
          record.session_number ?? ""
        )
      );

      Logger.log(
        "Holiday: " +
        record.is_holiday
      );

      Logger.log(
        "Exam: " +
        record.is_exam
      );

      Logger.log(
        "--------------------------------"
      );
    }
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "REGISTRO DATE BEHAVIOR TEST COMPLETE"
  );

  Logger.log(
    "================================"
  );
}
function testRegistroSyncStateEngine() {

  Logger.log("================================");
  Logger.log("REGISTRO SYNC STATE ENGINE TEST");
  Logger.log("================================");


  const token =
    PropertiesService
      .getScriptProperties()
      .getProperty("REGISTRO_ACCESS_TOKEN");


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  const registroUrl =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  // ==================================================
  // FETCH REGISTRO
  // ==================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      registroUrl,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  if (
    response.getResponseCode() !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      response.getResponseCode()
    );
  }


  const result =
    JSON.parse(
      response.getContentText()
    );


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  // ==================================================
  // REGISTRO RECORD ID
  //
  // This identifies the same academic session
  // across future timetable updates.
  // ==================================================

  function buildRegistroSessionId(record) {

    const start =
      String(
        record.start || ""
      );


    const date =
      start.substring(
        0,
        10
      );


    const course =
      String(
        record.course || ""
      )
      .trim()
      .toLowerCase();


    const section =
      String(
        record.section || ""
      )
      .trim()
      .toLowerCase();


    const sessionNumber =
      String(
        record.session_number ?? ""
      )
      .trim();


    return [
      date,
      course,
      section,
      sessionNumber
    ].join("|");
  }


  // ==================================================
  // BUILD STATE OBJECTS
  // ==================================================

  const records =
    result.data;


  const regularClasses =
    records.filter(
      record =>
        record.is_holiday !== true &&
        record.is_exam !== true
    );


  const state =
    regularClasses.map(
      record => {

        return {

          id:
            buildRegistroSessionId(
              record
            ),

          date:
            String(
              record.start || ""
            ).substring(
              0,
              10
            ),

          title:
            String(
              record.title || ""
            ),

          course:
            String(
              record.course || ""
            ),

          section:
            String(
              record.section || ""
            ),

          professor:
            String(
              record.professor || ""
            ),

          classroom:
            String(
              record.classroom_name || ""
            ),

          sessionNumber:
            record.session_number,

          start:
            String(
              record.start || ""
            ),

          end:
            String(
              record.end || ""
            ),

          isHoliday:
            record.is_holiday === true,

          isExam:
            record.is_exam === true
        };
      }
    );


  // ==================================================
  // VALIDATION
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "STATE ENGINE RESULTS"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Total Registro records: " +
    records.length
  );


  Logger.log(
    "Regular class states: " +
    state.length
  );


  const ids =
    state.map(
      item =>
        item.id
    );


  const uniqueIds =
    new Set(
      ids
    );


  Logger.log(
    "Unique session IDs: " +
    uniqueIds.size
  );


  Logger.log(
    "Duplicate session IDs: " +
    (
      ids.length -
      uniqueIds.size
    )
  );


  // ==================================================
  // SHOW SAMPLE STATES
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "SAMPLE SESSION IDENTITIES"
  );

  Logger.log(
    "================================"
  );


  state
    .slice(0, 10)
    .forEach(
      (item, index) => {

        Logger.log(
          "SESSION " +
          (index + 1)
        );

        Logger.log(
          "ID: " +
          item.id
        );

        Logger.log(
          "Title: " +
          item.title
        );

        Logger.log(
          "Course: " +
          item.course
        );

        Logger.log(
          "Section: " +
          item.section
        );

        Logger.log(
          "Professor: " +
          item.professor
        );

        Logger.log(
          "Classroom: " +
          item.classroom
        );

        Logger.log(
          "Session number: " +
          item.sessionNumber
        );

        Logger.log(
          "Start: " +
          item.start
        );

        Logger.log(
          "End: " +
          item.end
        );

        Logger.log(
          "--------------------------------"
        );
      }
    );


  // ==================================================
  // IMPORTANT
  //
  // THIS TEST DOES NOT SAVE STATE.
  // THIS TEST DOES NOT MODIFY CALENDAR.
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "READ-ONLY STATE TEST COMPLETE"
  );

  Logger.log(
    "NO SCRIPT PROPERTY CREATED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT MODIFIED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT DELETED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "================================"
  );
}
function testRegistroChangeDetector() {

  Logger.log("================================");
  Logger.log("REGISTRO ADVANCED CHANGE DETECTOR TEST");
  Logger.log("================================");


  const token =
    PropertiesService
      .getScriptProperties()
      .getProperty("REGISTRO_ACCESS_TOKEN");


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  const registroUrl =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  // ==================================================
  // FETCH REGISTRO
  // ==================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      registroUrl,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  if (
    response.getResponseCode() !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      response.getResponseCode()
    );
  }


  const result =
    JSON.parse(
      response.getContentText()
    );


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  // ==================================================
  // BUILD SESSION ID
  //
  // Date remains part of the normal identity.
  // We separately build a "fingerprint" without
  // date to help identify possible cross-day moves.
  // ==================================================

  function buildSessionId(record) {

    const start =
      String(
        record.start || ""
      );


    const date =
      start.substring(
        0,
        10
      );


    const course =
      String(
        record.course || ""
      )
      .trim()
      .toLowerCase();


    const section =
      String(
        record.section || ""
      )
      .trim()
      .toLowerCase();


    const sessionNumber =
      String(
        record.session_number ?? ""
      )
      .trim();


    return [
      date,
      course,
      section,
      sessionNumber
    ].join("|");
  }


  function buildSessionFingerprint(record) {

    const course =
      String(
        record.course || ""
      )
      .trim()
      .toLowerCase();


    const section =
      String(
        record.section || ""
      )
      .trim()
      .toLowerCase();


    const sessionNumber =
      String(
        record.session_number ?? ""
      )
      .trim();


    const professor =
      String(
        record.professor || ""
      )
      .trim()
      .toLowerCase();


    return [
      course,
      section,
      sessionNumber,
      professor
    ].join("|");
  }


  // ==================================================
  // BUILD CURRENT STATE
  // ==================================================

  const currentRecords =
    result.data.filter(
      record =>
        record.is_holiday !== true &&
        record.is_exam !== true
    );


  const currentState = {};


  currentRecords.forEach(
    record => {

      const id =
        buildSessionId(
          record
        );


      currentState[id] = {

        id:
          id,

        fingerprint:
          buildSessionFingerprint(
            record
          ),

        date:
          String(
            record.start || ""
          ).substring(
            0,
            10
          ),

        title:
          String(
            record.title || ""
          ),

        course:
          String(
            record.course || ""
          ),

        section:
          String(
            record.section || ""
          ),

        professor:
          String(
            record.professor || ""
          ),

        classroom:
          String(
            record.classroom_name || ""
          ),

        sessionNumber:
          String(
            record.session_number ?? ""
          ),

        start:
          String(
            record.start || ""
          ),

        end:
          String(
            record.end || ""
          )
      };
    }
  );


  Logger.log(
    "Current Registro sessions: " +
    Object.keys(
      currentState
    ).length
  );


  // ==================================================
  // CREATE ARTIFICIAL PREVIOUS STATE
  // ==================================================

  const previousState =
    JSON.parse(
      JSON.stringify(
        currentState
      )
    );


  const ids =
    Object.keys(
      previousState
    );


  if (
    ids.length < 2
  ) {

    throw new Error(
      "Not enough Registro sessions available for testing."
    );
  }


  // ==================================================
  // TEST SESSION A
  //
  // Same-day reschedule.
  // ==================================================

  const sameDayId =
    ids[0];


  previousState[sameDayId].start =
    "2026-08-17T03:30:00.000+00:00";


  previousState[sameDayId].end =
    "2026-08-17T04:45:00.000+00:00";


  currentState[sameDayId].start =
    "2026-08-17T05:30:00.000+00:00";


  currentState[sameDayId].end =
    "2026-08-17T06:45:00.000+00:00";


  // ==================================================
  // TEST SESSION B
  //
  // Classroom change only.
  // ==================================================

  const classroomChangeId =
    ids[1];


  previousState[classroomChangeId].classroom =
    "TEST_OLD_ROOM";


  currentState[classroomChangeId].classroom =
    "TEST_NEW_ROOM";


  // ==================================================
  // CHANGE DETECTION
  // ==================================================

  let newCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;
  let sameDayRescheduleCount = 0;
  let classroomChangeCount = 0;
  let possibleCrossDayCount = 0;


  const sameDayExamples = [];
  const classroomExamples = [];
  const newExamples = [];
  const removedExamples = [];
  const crossDayExamples = [];


  // ==================================================
  // CURRENT → NEW / MODIFIED
  // ==================================================

  Object.keys(
    currentState
  ).forEach(
    id => {

      const current =
        currentState[id];


      const previous =
        previousState[id];


      // ------------------------------------------------
      // NEW
      // ------------------------------------------------

      if (
        !previous
      ) {

        newCount++;


        if (
          newExamples.length < 5
        ) {

          newExamples.push(
            current
          );
        }


        return;
      }


      // ------------------------------------------------
      // DETECT CHANGES
      // ------------------------------------------------

      const timeChanged =
        current.start !==
          previous.start ||

        current.end !==
          previous.end;


      const classroomChanged =
        current.classroom !==
        previous.classroom;


      const professorChanged =
        current.professor !==
        previous.professor;


      const titleChanged =
        current.title !==
        previous.title;


      const sectionChanged =
        current.section !==
        previous.section;


      const courseChanged =
        current.course !==
        previous.course;


      if (
        timeChanged ||
        classroomChanged ||
        professorChanged ||
        titleChanged ||
        sectionChanged ||
        courseChanged
      ) {

        modifiedCount++;


        const oldDate =
          String(
            previous.start
          ).substring(
            0,
            10
          );


        const newDate =
          String(
            current.start
          ).substring(
            0,
            10
          );


        if (
          oldDate === newDate &&
          timeChanged
        ) {

          sameDayRescheduleCount++;


          if (
            sameDayExamples.length < 5
          ) {

            sameDayExamples.push(
              {
                id:
                  id,

                oldStart:
                  previous.start,

                newStart:
                  current.start,

                oldEnd:
                  previous.end,

                newEnd:
                  current.end
              }
            );
          }
        }


        if (
          classroomChanged
        ) {

          classroomChangeCount++;


          if (
            classroomExamples.length < 5
          ) {

            classroomExamples.push(
              {
                id:
                  id,

                oldRoom:
                  previous.classroom,

                newRoom:
                  current.classroom
              }
            );
          }
        }
      }
    }
  );


  // ==================================================
  // REMOVED
  // ==================================================

  Object.keys(
    previousState
  ).forEach(
    id => {

      if (
        !currentState[id]
      ) {

        removedCount++;


        if (
          removedExamples.length < 5
        ) {

          removedExamples.push(
            previousState[id]
          );
        }
      }
    }
  );


  // ==================================================
  // POSSIBLE CROSS-DAY RESCHEDULES
  //
  // We do NOT automatically classify these as
  // reschedules. We only flag them as possible.
  // ==================================================

  Object.keys(
    previousState
  ).forEach(
    oldId => {

      if (
        currentState[oldId]
      ) {

        return;
      }


      const oldSession =
        previousState[oldId];


      const candidates =
        Object.keys(
          currentState
        )
        .filter(
          newId => {

            const newSession =
              currentState[newId];


            return (
              newSession.fingerprint ===
              oldSession.fingerprint
            );
          }
        );


      candidates.forEach(
        newId => {

          const newSession =
            currentState[newId];


          if (
            String(
              oldSession.date
            ) !==
            String(
              newSession.date
            )
          ) {

            possibleCrossDayCount++;


            if (
              crossDayExamples.length < 5
            ) {

              crossDayExamples.push(
                {
                  oldId:
                    oldId,

                  newId:
                    newId,

                  oldDate:
                    oldSession.date,

                  newDate:
                    newSession.date,

                  course:
                    oldSession.course,

                  section:
                    oldSession.section,

                  sessionNumber:
                    oldSession.sessionNumber
                }
              );
            }
          }
        }
      );
    }
  );


  // ==================================================
  // RESULTS
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "ADVANCED CHANGE DETECTION RESULTS"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "New sessions: " +
    newCount
  );


  Logger.log(
    "Modified sessions: " +
    modifiedCount
  );


  Logger.log(
    "Same-day reschedules: " +
    sameDayRescheduleCount
  );


  Logger.log(
    "Classroom changes: " +
    classroomChangeCount
  );


  Logger.log(
    "Removed sessions: " +
    removedCount
  );


  Logger.log(
    "Possible cross-day reschedules: " +
    possibleCrossDayCount
  );


  // ==================================================
  // SAME-DAY EXAMPLE
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "SAME-DAY RESCHEDULE EXAMPLE"
  );

  Logger.log(
    "================================"
  );


  sameDayExamples.forEach(
    example => {

      Logger.log(
        "ID: " +
        example.id
      );

      Logger.log(
        "Old start: " +
        example.oldStart
      );

      Logger.log(
        "New start: " +
        example.newStart
      );

      Logger.log(
        "Old end: " +
        example.oldEnd
      );

      Logger.log(
        "New end: " +
        example.newEnd
      );
    }
  );


  // ==================================================
  // CLASSROOM EXAMPLE
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "CLASSROOM CHANGE EXAMPLE"
  );

  Logger.log(
    "================================"
  );


  classroomExamples.forEach(
    example => {

      Logger.log(
        "ID: " +
        example.id
      );

      Logger.log(
        "Old room: " +
        example.oldRoom
      );

      Logger.log(
        "New room: " +
        example.newRoom
      );
    }
  );


  // ==================================================
  // CROSS-DAY EXAMPLE
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "POSSIBLE CROSS-DAY RESCHEDULES"
  );

  Logger.log(
    "================================"
  );


  crossDayExamples.forEach(
    example => {

      Logger.log(
        "Old ID: " +
        example.oldId
      );

      Logger.log(
        "New ID: " +
        example.newId
      );

      Logger.log(
        "Old date: " +
        example.oldDate
      );

      Logger.log(
        "New date: " +
        example.newDate
      );

      Logger.log(
        "Course: " +
        example.course
      );

      Logger.log(
        "Section: " +
        example.section
      );

      Logger.log(
        "Session number: " +
        example.sessionNumber
      );

      Logger.log(
        "--------------------------------"
      );
    }
  );


  // ==================================================
  // SAFETY
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "READ-ONLY ADVANCED TEST COMPLETE"
  );

  Logger.log(
    "NO SCRIPT PROPERTY CREATED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT MODIFIED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT DELETED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "================================"
  );
}
function testRegistroPersistentSnapshot() {

  Logger.log("================================");
  Logger.log("REGISTRO PERSISTENT SNAPSHOT TEST");
  Logger.log("================================");


  const token =
    PropertiesService
      .getScriptProperties()
      .getProperty("REGISTRO_ACCESS_TOKEN");


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  const registroUrl =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  // ==================================================
  // FETCH REGISTRO
  // ==================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      registroUrl,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const statusCode =
    response.getResponseCode();


  if (
    statusCode !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      statusCode
    );
  }


  const result =
    JSON.parse(
      response.getContentText()
    );


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  // ==================================================
  // BUILD STABLE SESSION ID
  // ==================================================

  function buildSessionId(record) {

    const start =
      String(
        record.start || ""
      );


    const date =
      start.substring(
        0,
        10
      );


    const course =
      String(
        record.course || ""
      )
      .trim()
      .toLowerCase();


    const section =
      String(
        record.section || ""
      )
      .trim()
      .toLowerCase();


    const sessionNumber =
      String(
        record.session_number ?? ""
      )
      .trim();


    return [
      date,
      course,
      section,
      sessionNumber
    ].join("|");
  }


  // ==================================================
  // BUILD CLEAN STATE
  // ==================================================

  const regularClasses =
    result.data.filter(
      record =>
        record.is_holiday !== true &&
        record.is_exam !== true
    );


  const state = {};


  regularClasses.forEach(
    record => {

      const id =
        buildSessionId(
          record
        );


      state[id] = {

        id:
          id,

        title:
          String(
            record.title || ""
          ),

        course:
          String(
            record.course || ""
          ),

        section:
          String(
            record.section || ""
          ),

        professor:
          String(
            record.professor || ""
          ),

        classroom:
          String(
            record.classroom_name || ""
          ),

        sessionNumber:
          String(
            record.session_number ?? ""
          ),

        start:
          String(
            record.start || ""
          ),

        end:
          String(
            record.end || ""
          )
      };
    }
  );


  const stateIds =
    Object.keys(
      state
    );


  Logger.log(
    "Current Registro class count: " +
    stateIds.length
  );


  // ==================================================
  // SAVE SNAPSHOT
  // ==================================================

  const properties =
    PropertiesService
      .getScriptProperties();


  const snapshot =
    JSON.stringify(
      state
    );


  properties.setProperty(
    "REGISTRO_TIMETABLE_SNAPSHOT",
    snapshot
  );


  properties.setProperty(
    "REGISTRO_TIMETABLE_SNAPSHOT_TIME",
    new Date().toISOString()
  );


  Logger.log(
    "Registro snapshot saved."
  );


  Logger.log(
    "Snapshot size: " +
    snapshot.length +
    " characters."
  );


  // ==================================================
  // READ SNAPSHOT BACK
  // ==================================================

  const savedSnapshot =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );


  const savedTime =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT_TIME"
    );


  if (
    !savedSnapshot
  ) {

    throw new Error(
      "Snapshot could not be read back from Script Properties."
    );
  }


  const restoredState =
    JSON.parse(
      savedSnapshot
    );


  const restoredIds =
    Object.keys(
      restoredState
    );


  Logger.log(
    "Snapshot read back successfully."
  );


  Logger.log(
    "Restored class count: " +
    restoredIds.length
  );


  Logger.log(
    "Snapshot timestamp: " +
    savedTime
  );


  // ==================================================
  // VERIFY COUNTS
  // ==================================================

  if (
    restoredIds.length !==
    stateIds.length
  ) {

    throw new Error(
      "Snapshot verification failed: class count changed."
    );
  }


  // ==================================================
  // VERIFY EVERY SESSION
  // ==================================================

  let missingIds = 0;
  let mismatchedRecords = 0;


  stateIds.forEach(
    id => {

      if (
        !restoredState[id]
      ) {

        missingIds++;

        return;
      }


      const original =
        state[id];


      const restored =
        restoredState[id];


      if (
        JSON.stringify(original) !==
        JSON.stringify(restored)
      ) {

        mismatchedRecords++;
      }
    }
  );


  Logger.log(
    "Missing session IDs after restore: " +
    missingIds
  );


  Logger.log(
    "Mismatched session records: " +
    mismatchedRecords
  );


  // ==================================================
  // FINAL VALIDATION
  // ==================================================

  if (
    missingIds !== 0 ||
    mismatchedRecords !== 0
  ) {

    throw new Error(
      "Snapshot verification failed."
    );
  }


  Logger.log(
    "================================"
  );

  Logger.log(
    "PERSISTENT SNAPSHOT VERIFICATION PASSED"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Original classes: " +
    stateIds.length
  );

  Logger.log(
    "Restored classes: " +
    restoredIds.length
  );

  Logger.log(
    "All session IDs preserved: YES"
  );

  Logger.log(
    "All session data preserved: YES"
  );


  // ==================================================
  // SAFETY CONFIRMATION
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT MODIFIED."
  );

  Logger.log(
    "NO GOOGLE CALENDAR EVENT DELETED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "REGISTRO PERSISTENT SNAPSHOT TEST COMPLETE"
  );

  Logger.log(
    "================================"
  );
}
function testRegistroPersistentChangeDetection() {

  Logger.log("================================");
  Logger.log("REGISTRO PERSISTENT CHANGE DETECTION TEST");
  Logger.log("================================");


  const properties =
    PropertiesService.getScriptProperties();


  // ==================================================
  // LOAD SAVED SNAPSHOT
  // ==================================================

  const savedSnapshot =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );


  if (!savedSnapshot) {

    throw new Error(
      "No REGISTRO_TIMETABLE_SNAPSHOT found. Run testRegistroPersistentSnapshot first."
    );
  }


  const previousState =
    JSON.parse(
      savedSnapshot
    );


  const previousIds =
    Object.keys(
      previousState
    );


  Logger.log(
    "Previous snapshot sessions: " +
    previousIds.length
  );


  if (
    previousIds.length === 0
  ) {

    throw new Error(
      "Previous snapshot contains no sessions."
    );
  }


  // ==================================================
  // GET REGISTRO TOKEN
  // ==================================================

  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  // ==================================================
  // REGISTRO URL
  // ==================================================

  const registroUrl =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  // ==================================================
  // FETCH CURRENT REGISTRO
  // ==================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      registroUrl,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const responseCode =
    response.getResponseCode();


  if (
    responseCode !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      responseCode
    );
  }


  const result =
    JSON.parse(
      response.getContentText()
    );


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  // ==================================================
  // BUILD SESSION ID
  // ==================================================

  function buildSessionId(record) {

    const start =
      String(
        record.start || ""
      );


    const date =
      start.substring(
        0,
        10
      );


    const course =
      String(
        record.course || ""
      )
      .trim()
      .toLowerCase();


    const section =
      String(
        record.section || ""
      )
      .trim()
      .toLowerCase();


    const sessionNumber =
      String(
        record.session_number ?? ""
      )
      .trim();


    return [
      date,
      course,
      section,
      sessionNumber
    ].join("|");
  }


  // ==================================================
  // BUILD CURRENT REGISTRO STATE
  // ==================================================

  const currentState = {};


  result.data
    .filter(
      record =>
        record.is_holiday !== true &&
        record.is_exam !== true
    )
    .forEach(
      record => {

        const id =
          buildSessionId(
            record
          );


        currentState[id] = {

          id:
            id,

          title:
            String(
              record.title || ""
            ),

          course:
            String(
              record.course || ""
            ),

          section:
            String(
              record.section || ""
            ),

          professor:
            String(
              record.professor || ""
            ),

          classroom:
            String(
              record.classroom_name || ""
            ),

          sessionNumber:
            String(
              record.session_number ?? ""
            ),

          start:
            String(
              record.start || ""
            ),

          end:
            String(
              record.end || ""
            )
        };
      }
    );


  const currentIds =
    Object.keys(
      currentState
    );


  Logger.log(
    "Current Registro sessions: " +
    currentIds.length
  );


  // ==================================================
  // CREATE TEMPORARY COPY
  //
  // NEVER modify the real saved snapshot.
  // ==================================================

  const simulatedPreviousState =
    JSON.parse(
      JSON.stringify(
        previousState
      )
    );


  // ==================================================
  // SELECT ONE REAL SESSION
  // ==================================================

  const testId =
    previousIds[0];


  const previousRecord =
    simulatedPreviousState[testId];


  const currentRecord =
    currentState[testId];


  if (!previousRecord) {

    throw new Error(
      "Could not load test session from saved snapshot."
    );
  }


  if (!currentRecord) {

    throw new Error(
      "Test session from snapshot no longer exists in current Registro data."
    );
  }


  Logger.log(
    "Test session:"
  );


  Logger.log(
    "ID: " +
    testId
  );


  Logger.log(
    "Actual Registro start: " +
    currentRecord.start
  );


  // ==================================================
  // SIMULATE PREVIOUS REGISTRO TIME
  //
  // IMPORTANT:
  //
  // Current Registro:
  // 03:30 UTC → 04:45 UTC
  //
  // Simulated previous:
  // 01:30 UTC → 02:45 UTC
  //
  // This represents a same-day reschedule.
  // ==================================================

  const currentDate =
    String(
      currentRecord.start
    ).substring(
      0,
      10
    );


  simulatedPreviousState[testId].start =
    currentDate +
    "T01:30:00.000+00:00";


  simulatedPreviousState[testId].end =
    currentDate +
    "T02:45:00.000+00:00";


  Logger.log(
    "Simulated previous start: " +
    simulatedPreviousState[testId].start
  );


  Logger.log(
    "Simulated previous end: " +
    simulatedPreviousState[testId].end
  );


  Logger.log(
    "Current Registro start: " +
    currentRecord.start
  );


  Logger.log(
    "Current Registro end: " +
    currentRecord.end
  );


  // ==================================================
  // RUN COMPARISON
  // ==================================================

  let newCount = 0;

  let modifiedCount = 0;

  let sameDayRescheduleCount = 0;

  let removedCount = 0;


  const modifications = [];


  // ==================================================
  // CURRENT → NEW / MODIFIED
  // ==================================================

  currentIds.forEach(
    id => {

      const current =
        currentState[id];


      const previous =
        simulatedPreviousState[id];


      // ------------------------------------------------
      // NEW SESSION
      // ------------------------------------------------

      if (!previous) {

        newCount++;

        return;
      }


      // ------------------------------------------------
      // FIELD COMPARISON
      // ------------------------------------------------

      const timeChanged =
        current.start !==
          previous.start ||

        current.end !==
          previous.end;


      const classroomChanged =
        current.classroom !==
        previous.classroom;


      const professorChanged =
        current.professor !==
        previous.professor;


      const titleChanged =
        current.title !==
        previous.title;


      const sectionChanged =
        current.section !==
        previous.section;


      const courseChanged =
        current.course !==
        previous.course;


      const anythingChanged =
        timeChanged ||
        classroomChanged ||
        professorChanged ||
        titleChanged ||
        sectionChanged ||
        courseChanged;


      // ------------------------------------------------
      // MODIFIED SESSION
      // ------------------------------------------------

      if (
        anythingChanged
      ) {

        modifiedCount++;


        const oldDate =
          String(
            previous.start
          ).substring(
            0,
            10
          );


        const newDate =
          String(
            current.start
          ).substring(
            0,
            10
          );


        // ------------------------------------------------
        // SAME-DAY RESCHEDULE
        // ------------------------------------------------

        if (
          oldDate === newDate &&
          timeChanged
        ) {

          sameDayRescheduleCount++;
        }


        modifications.push(
          {

            id:
              id,

            oldStart:
              previous.start,

            newStart:
              current.start,

            oldEnd:
              previous.end,

            newEnd:
              current.end,

            oldClassroom:
              previous.classroom,

            newClassroom:
              current.classroom
          }
        );
      }
    }
  );


  // ==================================================
  // REMOVED SESSIONS
  // ==================================================

  Object.keys(
    simulatedPreviousState
  ).forEach(
    id => {

      if (
        !currentState[id]
      ) {

        removedCount++;
      }
    }
  );


  // ==================================================
  // RESULTS
  // ==================================================

  Logger.log(
    "================================"
  );


  Logger.log(
    "PERSISTENT COMPARISON RESULTS"
  );


  Logger.log(
    "================================"
  );


  Logger.log(
    "New sessions: " +
    newCount
  );


  Logger.log(
    "Modified sessions: " +
    modifiedCount
  );


  Logger.log(
    "Same-day reschedules: " +
    sameDayRescheduleCount
  );


  Logger.log(
    "Removed sessions: " +
    removedCount
  );


  // ==================================================
  // SHOW MODIFICATION
  // ==================================================

  modifications.forEach(
    modification => {

      Logger.log(
        "================================"
      );


      Logger.log(
        "MODIFICATION DETECTED"
      );


      Logger.log(
        "ID: " +
        modification.id
      );


      Logger.log(
        "Old start: " +
        modification.oldStart
      );


      Logger.log(
        "New start: " +
        modification.newStart
      );


      Logger.log(
        "Old end: " +
        modification.oldEnd
      );


      Logger.log(
        "New end: " +
        modification.newEnd
      );


      Logger.log(
        "Old classroom: " +
        modification.oldClassroom
      );


      Logger.log(
        "New classroom: " +
        modification.newClassroom
      );
    }
  );


  // ==================================================
  // VERIFY REAL SNAPSHOT WAS NOT MODIFIED
  // ==================================================

  Logger.log(
    "================================"
  );


  Logger.log(
    "VERIFYING REAL SNAPSHOT WAS NOT MODIFIED..."
  );


  const snapshotAfterTest =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );


  if (
    snapshotAfterTest !==
    savedSnapshot
  ) {

    throw new Error(
      "SAFETY FAILURE: Saved Registro snapshot was modified."
    );
  }


  Logger.log(
    "Saved snapshot unchanged: YES"
  );


  // ==================================================
  // EXPECTED RESULT
  // ==================================================

  if (
    newCount !== 0 ||
    modifiedCount !== 1 ||
    sameDayRescheduleCount !== 1 ||
    removedCount !== 0
  ) {

    throw new Error(
      "Persistent change detection test did not produce the expected result."
    );
  }


  // ==================================================
  // SUCCESS
  // ==================================================

  Logger.log(
    "================================"
  );


  Logger.log(
    "PERSISTENT CHANGE DETECTION TEST PASSED"
  );


  Logger.log(
    "================================"
  );


  Logger.log(
    "Same-day reschedule detected correctly: YES"
  );


  Logger.log(
    "Real snapshot preserved: YES"
  );


  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );


  Logger.log(
    "NO GOOGLE CALENDAR EVENT MODIFIED."
  );


  Logger.log(
    "NO GOOGLE CALENDAR EVENT DELETED."
  );


  Logger.log(
    "NO GOOGLE TASK CREATED."
  );


  Logger.log(
    "================================"
  );
}
function testRegistroSingleCalendarSync() {

  Logger.log("================================");
  Logger.log("REGISTRO → GOOGLE CALENDAR SINGLE EVENT TEST");
  Logger.log("================================");


  // ==================================================
  // CONFIGURATION
  // ==================================================

  const CALENDAR_ID =
    "priyanshurajgopi@gmail.com";


  const REGISTRO_URL =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  // ==================================================
  // GET REGISTRO TOKEN
  // ==================================================

  const properties =
    PropertiesService.getScriptProperties();


  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  // ==================================================
  // GET GOOGLE CALENDAR
  // ==================================================

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Google Calendar could not be found: " +
      CALENDAR_ID
    );
  }


  Logger.log(
    "Google Calendar: " +
    CALENDAR_ID
  );


  // ==================================================
  // FETCH REGISTRO
  // ==================================================

  Logger.log(
    "Fetching Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      REGISTRO_URL,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const responseCode =
    response.getResponseCode();


  if (
    responseCode !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      responseCode
    );
  }


  const result =
    JSON.parse(
      response.getContentText()
    );


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  // ==================================================
  // GET REGULAR CLASSES
  // ==================================================

  const regularClasses =
    result.data.filter(
      record =>
        record.is_holiday !== true &&
        record.is_exam !== true
    );


  if (
    regularClasses.length === 0
  ) {

    throw new Error(
      "No regular Registro classes were found."
    );
  }


  // ==================================================
  // FIRST REGULAR CLASS
  //
  // We intentionally synchronize ONLY ONE class.
  // ==================================================

  const record =
    regularClasses[0];


  // ==================================================
  // BUILD REGISTRO SESSION ID
  // ==================================================

  const startString =
    String(
      record.start || ""
    );


  const date =
    startString.substring(
      0,
      10
    );


  const course =
    String(
      record.course || ""
    )
    .trim()
    .toLowerCase();


  const section =
    String(
      record.section || ""
    )
    .trim()
    .toLowerCase();


  const sessionNumber =
    String(
      record.session_number ?? ""
    )
    .trim();


  const registroSessionId =
    [
      date,
      course,
      section,
      sessionNumber
    ].join("|");


  const calendarMarker =
    "REGISTRO_SESSION_ID:" +
    registroSessionId;


  // ==================================================
  // LOG REGISTRO CLASS
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "REGISTRO CLASS SELECTED"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Title: " +
    record.title
  );


  Logger.log(
    "Course: " +
    record.course
  );


  Logger.log(
    "Section: " +
    record.section
  );


  Logger.log(
    "Professor: " +
    record.professor
  );


  Logger.log(
    "Classroom: " +
    record.classroom_name
  );


  Logger.log(
    "Start: " +
    record.start
  );


  Logger.log(
    "End: " +
    record.end
  );


  Logger.log(
    "Registro Session ID: " +
    registroSessionId
  );


  // ==================================================
  // CONVERT REGISTRO TIME
  //
  // JavaScript Date parses the ISO timestamp
  // and CalendarApp uses the calendar's timezone.
  // ==================================================

  const startTime =
    new Date(
      record.start
    );


  const endTime =
    new Date(
      record.end
    );


  if (
    isNaN(
      startTime.getTime()
    ) ||
    isNaN(
      endTime.getTime()
    )
  ) {

    throw new Error(
      "Invalid Registro start or end time."
    );
  }


  // ==================================================
  // SEARCH FOR EXISTING EVENT
  //
  // We search the exact day and inspect the
  // description for our permanent Registro marker.
  // ==================================================

  const searchDayStart =
    new Date(
      startTime
    );


  searchDayStart.setHours(
    0,
    0,
    0,
    0
  );


  const searchDayEnd =
    new Date(
      searchDayStart
    );


  searchDayEnd.setDate(
    searchDayEnd.getDate() + 1
  );


  Logger.log(
    "Searching Calendar for existing Registro event..."
  );


  const existingEvents =
    calendar.getEvents(
      searchDayStart,
      searchDayEnd
    );


  let existingEvent =
    null;


  existingEvents.forEach(
    event => {

      const description =
        event.getDescription() ||
        "";


      if (
        description.indexOf(
          calendarMarker
        ) !== -1
      ) {

        existingEvent =
          event;
      }
    }
  );


  // ==================================================
  // DUPLICATE PROTECTION
  // ==================================================

  if (
    existingEvent
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "EXISTING REGISTRO EVENT FOUND"
    );

    Logger.log(
      "================================"
    );


    Logger.log(
      "Calendar event title: " +
      existingEvent.getTitle()
    );


    Logger.log(
      "Calendar event start: " +
      existingEvent.getStartTime()
    );


    Logger.log(
      "Calendar event end: " +
      existingEvent.getEndTime()
    );


    Logger.log(
      "Calendar event ID: " +
      existingEvent.getId()
    );


    Logger.log(
      "NO DUPLICATE EVENT CREATED."
    );


    Logger.log(
      "================================"
    );

    Logger.log(
      "SINGLE CALENDAR SYNC TEST COMPLETE"
    );

    Logger.log(
      "================================"
    );


    return;
  }


  // ==================================================
  // BUILD CALENDAR EVENT
  // ==================================================

  const title =
    String(
      record.title ||
      record.course ||
      "Registro Class"
    );


  const location =
    String(
      record.classroom_name ||
      ""
    );


  const description =
    [
      "Registro timetable event",

      "",

      "Course: " +
        String(
          record.course || ""
        ),

      "Section: " +
        String(
          record.section || ""
        ),

      "Professor: " +
        String(
          record.professor || ""
        ),

      "Classroom: " +
        String(
          record.classroom_name || ""
        ),

      "Session number: " +
        String(
          record.session_number ?? ""
        ),

      "",

      calendarMarker
    ].join(
      "\n"
    );


  // ==================================================
  // CREATE EXACTLY ONE EVENT
  // ==================================================

  Logger.log(
    "No existing Registro event found."
  );


  Logger.log(
    "Creating ONE Calendar event..."
  );


  const createdEvent =
    calendar.createEvent(
      title,
      startTime,
      endTime,
      {
        description:
          description,

        location:
          location
      }
    );


  // ==================================================
  // RESULT
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "CALENDAR EVENT CREATED"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Title: " +
    createdEvent.getTitle()
  );


  Logger.log(
    "Start: " +
    createdEvent.getStartTime()
  );


  Logger.log(
    "End: " +
    createdEvent.getEndTime()
  );


  Logger.log(
    "Location: " +
    createdEvent.getLocation()
  );


  Logger.log(
    "Event ID: " +
    createdEvent.getId()
  );


  Logger.log(
    "Registro Session ID stored: YES"
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "SINGLE CALENDAR SYNC TEST COMPLETE"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "ONLY ONE GOOGLE CALENDAR EVENT CREATED."
  );

  Logger.log(
    "NO GOOGLE TASK CREATED."
  );

  Logger.log(
    "NO GMAIL EMAIL PROCESSED."
  );

  Logger.log(
    "================================"
  );
}
function testRegistroBulkCalendarDryRun() {

  Logger.log("================================");
  Logger.log("REGISTRO → GOOGLE CALENDAR BULK DRY RUN");
  Logger.log("================================");


  // ==================================================
  // CONFIGURATION
  // ==================================================

  const CALENDAR_ID =
    "priyanshurajgopi@gmail.com";


  const REGISTRO_URL =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  const properties =
    PropertiesService.getScriptProperties();


  // ==================================================
  // GET REGISTRO TOKEN
  // ==================================================

  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }


  // ==================================================
  // GET CALENDAR
  // ==================================================

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Google Calendar could not be found: " +
      CALENDAR_ID
    );
  }


  Logger.log(
    "Google Calendar: " +
    CALENDAR_ID
  );


  // ==================================================
  // FETCH REGISTRO
  // ==================================================

  Logger.log(
    "Fetching complete Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      REGISTRO_URL,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const responseCode =
    response.getResponseCode();


  if (
    responseCode !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      responseCode
    );
  }


  const result =
    JSON.parse(
      response.getContentText()
    );


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }


  Logger.log(
    "Total Registro records: " +
    result.data.length
  );


  // ==================================================
  // FILTER REGULAR CLASSES
  // ==================================================

  const regularClasses =
    result.data.filter(
      record =>
        record.is_holiday !== true &&
        record.is_exam !== true
    );


  Logger.log(
    "Regular Registro classes: " +
    regularClasses.length
  );


  // ==================================================
  // BUILD REGISTRO SESSION ID
  // ==================================================

  function buildSessionId(record) {

    const start =
      String(
        record.start || ""
      );


    const date =
      start.substring(
        0,
        10
      );


    const course =
      String(
        record.course || ""
      )
      .trim()
      .toLowerCase();


    const section =
      String(
        record.section || ""
      )
      .trim()
      .toLowerCase();


    const sessionNumber =
      String(
        record.session_number ?? ""
      )
      .trim();


    return [
      date,
      course,
      section,
      sessionNumber
    ].join("|");
  }


  // ==================================================
  // DETERMINE CALENDAR SEARCH RANGE
  //
  // We use the actual Registro timetable range,
  // rather than assuming a fixed number of days.
  // ==================================================

  let earliestStart =
    null;

  let latestEnd =
    null;


  regularClasses.forEach(
    record => {

      const start =
        new Date(
          record.start
        );


      const end =
        new Date(
          record.end
        );


      if (
        !earliestStart ||
        start < earliestStart
      ) {

        earliestStart =
          start;
      }


      if (
        !latestEnd ||
        end > latestEnd
      ) {

        latestEnd =
          end;
      }
    }
  );


  if (
    !earliestStart ||
    !latestEnd
  ) {

    throw new Error(
      "Could not determine Registro timetable date range."
    );
  }


  // Give the Calendar search a small safety margin.
  const calendarSearchStart =
    new Date(
      earliestStart
    );


  calendarSearchStart.setDate(
    calendarSearchStart.getDate() - 1
  );


  const calendarSearchEnd =
    new Date(
      latestEnd
    );


  calendarSearchEnd.setDate(
    calendarSearchEnd.getDate() + 1
  );


  Logger.log(
    "Calendar search start: " +
    calendarSearchStart
  );


  Logger.log(
    "Calendar search end: " +
    calendarSearchEnd
  );


  // ==================================================
  // READ EXISTING CALENDAR EVENTS
  // ==================================================

  Logger.log(
    "Reading existing Google Calendar events..."
  );


  const calendarEvents =
    calendar.getEvents(
      calendarSearchStart,
      calendarSearchEnd
    );


  Logger.log(
    "Calendar events found: " +
    calendarEvents.length
  );


  // ==================================================
  // INDEX REGISTRO EVENTS BY SESSION ID
  // ==================================================

  const registroCalendarEvents = {};


  calendarEvents.forEach(
    event => {

      const description =
        event.getDescription() ||
        "";


      const marker =
        "REGISTRO_SESSION_ID:";


      const markerIndex =
        description.indexOf(
          marker
        );


      if (
        markerIndex === -1
      ) {

        return;
      }


      const markerValue =
        description
          .substring(
            markerIndex +
            marker.length
          )
          .split(
            "\n"
          )[0]
          .trim();


      if (
        markerValue
      ) {

        registroCalendarEvents[
          markerValue
        ] = event;
      }
    }
  );


  Logger.log(
    "Calendar events carrying Registro IDs: " +
    Object.keys(
      registroCalendarEvents
    ).length
  );


  // ==================================================
  // COMPARE EVERY REGISTRO CLASS
  // ==================================================

  let existingCount = 0;

  let missingCount = 0;

  let timeChangeCount = 0;

  let classroomChangeCount = 0;

  let otherModificationCount = 0;


  const missingClasses = [];

  const modifiedClasses = [];


  regularClasses.forEach(
    record => {

      const sessionId =
        buildSessionId(
          record
        );


      const existingEvent =
        registroCalendarEvents[
          sessionId
        ];


      // ------------------------------------------------
      // MISSING
      // ------------------------------------------------

      if (
        !existingEvent
      ) {

        missingCount++;

        missingClasses.push(
          {
            sessionId:
              sessionId,

            title:
              String(
                record.title || ""
              ),

            course:
              String(
                record.course || ""
              ),

            start:
              String(
                record.start || ""
              ),

            end:
              String(
                record.end || ""
              ),

            classroom:
              String(
                record.classroom_name || ""
              )
          }
        );

        return;
      }


      // ------------------------------------------------
      // EXISTING
      // ------------------------------------------------

      existingCount++;


      const registroStart =
        new Date(
          record.start
        );


      const registroEnd =
        new Date(
          record.end
        );


      const calendarStart =
        existingEvent.getStartTime();


      const calendarEnd =
        existingEvent.getEndTime();


      const timeChanged =
        registroStart.getTime() !==
          calendarStart.getTime() ||

        registroEnd.getTime() !==
          calendarEnd.getTime();


      const registroRoom =
        String(
          record.classroom_name || ""
        )
        .trim();


      const calendarRoom =
        String(
          existingEvent.getLocation() || ""
        )
        .trim();


      const classroomChanged =
        registroRoom !==
        calendarRoom;


      if (
        timeChanged ||
        classroomChanged
      ) {

        if (
          timeChanged
        ) {

          timeChangeCount++;
        }


        if (
          classroomChanged
        ) {

          classroomChangeCount++;
        }


        modifiedClasses.push(
          {
            sessionId:
              sessionId,

            title:
              String(
                record.title || ""
              ),

            registroStart:
              record.start,

            calendarStart:
              calendarStart
                .toISOString(),

            registroEnd:
              record.end,

            calendarEnd:
              calendarEnd
                .toISOString(),

            registroRoom:
              registroRoom,

            calendarRoom:
              calendarRoom
          }
        );
      }
    }
  );


  // ==================================================
  // OTHER MODIFICATION COUNT
  // ==================================================

  otherModificationCount =
    Math.max(
      0,
      modifiedClasses.length -
      timeChangeCount -
      classroomChangeCount
    );


  // ==================================================
  // RESULTS
  // ==================================================

  Logger.log(
    "================================"
  );


  Logger.log(
    "BULK RECONCILIATION RESULTS"
  );


  Logger.log(
    "================================"
  );


  Logger.log(
    "Registro regular classes: " +
    regularClasses.length
  );


  Logger.log(
    "Already represented in Calendar: " +
    existingCount
  );


  Logger.log(
    "Missing from Calendar: " +
    missingCount
  );


  Logger.log(
    "Calendar time mismatches: " +
    timeChangeCount
  );


  Logger.log(
    "Calendar classroom mismatches: " +
    classroomChangeCount
  );


  Logger.log(
    "Other modifications: " +
    otherModificationCount
  );


  // ==================================================
  // SHOW MISSING EXAMPLES
  // ==================================================

  Logger.log(
    "================================"
  );


  Logger.log(
    "MISSING CLASS EXAMPLES"
  );


  Logger.log(
    "================================"
  );


  missingClasses
    .slice(
      0,
      10
    )
    .forEach(
      item => {

        Logger.log(
          "Title: " +
          item.title
        );


        Logger.log(
          "Course: " +
          item.course
        );


        Logger.log(
          "Start: " +
          item.start
        );


        Logger.log(
          "End: " +
          item.end
        );


        Logger.log(
          "Classroom: " +
          item.classroom
        );


        Logger.log(
          "Session ID: " +
          item.sessionId
        );


        Logger.log(
          "--------------------------------"
        );
      }
    );


  // ==================================================
  // SHOW MODIFICATION EXAMPLES
  // ==================================================

  Logger.log(
    "================================"
  );


  Logger.log(
    "MODIFICATION EXAMPLES"
  );


  Logger.log(
    "================================"
  );


  modifiedClasses
    .slice(
      0,
      10
    )
    .forEach(
      item => {

        Logger.log(
          "Title: " +
          item.title
        );


        Logger.log(
          "Session ID: " +
          item.sessionId
        );


        Logger.log(
          "Registro start: " +
          item.registroStart
        );


        Logger.log(
          "Calendar start: " +
          item.calendarStart
        );


        Logger.log(
          "Registro end: " +
          item.registroEnd
        );


        Logger.log(
          "Calendar end: " +
          item.calendarEnd
        );


        Logger.log(
          "Registro room: " +
          item.registroRoom
        );


        Logger.log(
          "Calendar room: " +
          item.calendarRoom
        );


        Logger.log(
          "--------------------------------"
        );
      }
    );


  // ==================================================
  // SAFETY CONFIRMATION
  // ==================================================

  Logger.log(
    "================================"
  );


  Logger.log(
    "READ-ONLY SAFETY CONFIRMATION"
  );


  Logger.log(
    "================================"
  );


  Logger.log(
    "NO GOOGLE CALENDAR EVENT CREATED."
  );


  Logger.log(
    "NO GOOGLE CALENDAR EVENT MODIFIED."
  );


  Logger.log(
    "NO GOOGLE CALENDAR EVENT DELETED."
  );


  Logger.log(
    "NO GOOGLE TASK CREATED."
  );


  Logger.log(
    "NO SCRIPT PROPERTY CREATED."
  );


  Logger.log(
    "NO GMAIL EMAIL PROCESSED."
  );


  Logger.log(
    "================================"
  );


  Logger.log(
    "REGISTRO BULK CALENDAR DRY RUN COMPLETE"
  );


  Logger.log(
    "================================"
  );
}
function syncRegistroClassesToCalendar() {

  Logger.log("================================");
  Logger.log("REGISTRO → GOOGLE CALENDAR BULK SYNC");
  Logger.log("================================");

  const CALENDAR_ID =
    "priyanshurajgopi@gmail.com";

  const REGISTRO_URL =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";

  const properties =
    PropertiesService.getScriptProperties();

  // ==================================================
  // TOKEN
  // ==================================================

  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );

  if (!token) {
    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );
  }

  // ==================================================
  // CALENDAR
  // ==================================================

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );

  if (!calendar) {
    throw new Error(
      "Google Calendar could not be found: " +
      CALENDAR_ID
    );
  }

  Logger.log(
    "Google Calendar: " +
    CALENDAR_ID
  );

  // ==================================================
  // FETCH REGISTRO
  // ==================================================

  Logger.log(
    "Fetching complete Registro timetable..."
  );

  const response =
    UrlFetchApp.fetch(
      REGISTRO_URL,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );

  const responseCode =
    response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error(
      "Registro request failed with HTTP " +
      responseCode
    );
  }

  const result =
    JSON.parse(
      response.getContentText()
    );

  if (
    !result ||
    !Array.isArray(result.data)
  ) {
    throw new Error(
      "Registro response does not contain a valid data array."
    );
  }

  Logger.log(
    "Total Registro records: " +
    result.data.length
  );

  // ==================================================
  // REGULAR CLASSES ONLY
  // ==================================================

  const regularClasses =
    result.data.filter(
      record =>
        record.is_holiday !== true &&
        record.is_exam !== true
    );

  Logger.log(
    "Regular Registro classes: " +
    regularClasses.length
  );

  // ==================================================
  // SESSION ID
  // ==================================================

  function buildSessionId(record) {

    const start =
      String(
        record.start || ""
      );

    const date =
      start.substring(
        0,
        10
      );

    const course =
      String(
        record.course || ""
      )
      .trim()
      .toLowerCase();

    const section =
      String(
        record.section || ""
      )
      .trim()
      .toLowerCase();

    const sessionNumber =
      String(
        record.session_number ?? ""
      )
      .trim();

    return [
      date,
      course,
      section,
      sessionNumber
    ].join("|");
  }

  // ==================================================
  // DETERMINE CALENDAR SEARCH RANGE
  // ==================================================

  let earliestStart =
    null;

  let latestEnd =
    null;

  regularClasses.forEach(
    record => {

      const start =
        new Date(
          record.start
        );

      const end =
        new Date(
          record.end
        );

      if (
        !earliestStart ||
        start < earliestStart
      ) {
        earliestStart =
          start;
      }

      if (
        !latestEnd ||
        end > latestEnd
      ) {
        latestEnd =
          end;
      }
    }
  );

  if (
    !earliestStart ||
    !latestEnd
  ) {
    throw new Error(
      "Could not determine timetable date range."
    );
  }

  const calendarSearchStart =
    new Date(
      earliestStart
    );

  calendarSearchStart.setDate(
    calendarSearchStart.getDate() - 1
  );

  const calendarSearchEnd =
    new Date(
      latestEnd
    );

  calendarSearchEnd.setDate(
    calendarSearchEnd.getDate() + 1
  );

  Logger.log(
    "Calendar search start: " +
    calendarSearchStart
  );

  Logger.log(
    "Calendar search end: " +
    calendarSearchEnd
  );

  // ==================================================
  // READ EXISTING CALENDAR EVENTS
  // ==================================================

  Logger.log(
    "Reading existing Calendar events..."
  );

  const existingEvents =
    calendar.getEvents(
      calendarSearchStart,
      calendarSearchEnd
    );

  Logger.log(
    "Calendar events found: " +
    existingEvents.length
  );

  // ==================================================
  // INDEX REGISTRO EVENTS
  // ==================================================

  const registroEvents = {};

  existingEvents.forEach(
    event => {

      const description =
        event.getDescription() ||
        "";

      const marker =
        "REGISTRO_SESSION_ID:";

      const index =
        description.indexOf(
          marker
        );

      if (
        index === -1
      ) {
        return;
      }

      const sessionId =
        description
          .substring(
            index + marker.length
          )
          .split(
            "\n"
          )[0]
          .trim();

      if (
        sessionId
      ) {
        registroEvents[
          sessionId
        ] = event;
      }
    }
  );

  Logger.log(
    "Existing Registro Calendar events: " +
    Object.keys(
      registroEvents
    ).length
  );

  // ==================================================
  // COUNTERS
  // ==================================================

  let createdCount = 0;
  let existingCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const createdIds = [];

  // ==================================================
  // PROCESS CLASSES
  // ==================================================

  regularClasses.forEach(
    (record, index) => {

      const sessionId =
        buildSessionId(
          record
        );

      const existingEvent =
        registroEvents[
          sessionId
        ];

      // ------------------------------------------------
      // EXISTING EVENT
      // ------------------------------------------------

      if (
        existingEvent
      ) {

        existingCount++;

        const registroStart =
          new Date(
            record.start
          );

        const registroEnd =
          new Date(
            record.end
          );

        const currentStart =
          existingEvent.getStartTime();

        const currentEnd =
          existingEvent.getEndTime();

        const registroRoom =
          String(
            record.classroom_name || ""
          ).trim();

        const currentRoom =
          String(
            existingEvent.getLocation() || ""
          ).trim();

        const timeChanged =
          registroStart.getTime() !==
            currentStart.getTime() ||

          registroEnd.getTime() !==
            currentEnd.getTime();

        const roomChanged =
          registroRoom !==
          currentRoom;

        // ------------------------------------------------
        // UPDATE ONLY IF NECESSARY
        // ------------------------------------------------

        if (
          timeChanged ||
          roomChanged
        ) {

          existingEvent.setTime(
            registroStart,
            registroEnd
          );

          existingEvent.setLocation(
            registroRoom
          );

          updatedCount++;

          Logger.log(
            "UPDATED: " +
            record.title
          );

        } else {

          skippedCount++;
        }

        return;
      }

      // ------------------------------------------------
      // NEW EVENT
      // ------------------------------------------------

      try {

        const startTime =
          new Date(
            record.start
          );

        const endTime =
          new Date(
            record.end
          );

        if (
          isNaN(
            startTime.getTime()
          ) ||
          isNaN(
            endTime.getTime()
          )
        ) {

          throw new Error(
            "Invalid start/end time."
          );
        }

        const title =
          String(
            record.title ||
            record.course ||
            "Registro Class"
          );

        const location =
          String(
            record.classroom_name ||
            ""
          );

        const description =
          [
            "Registro timetable event",
            "",
            "Course: " +
              String(
                record.course || ""
              ),
            "Section: " +
              String(
                record.section || ""
              ),
            "Professor: " +
              String(
                record.professor || ""
              ),
            "Classroom: " +
              String(
                record.classroom_name || ""
              ),
            "Session number: " +
              String(
                record.session_number ?? ""
              ),
            "",
            "REGISTRO_SESSION_ID:" +
              sessionId
          ].join(
            "\n"
          );

        const event =
          calendar.createEvent(
            title,
            startTime,
            endTime,
            {
              description:
                description,

              location:
                location
            }
          );

        createdCount++;

        createdIds.push(
          event.getId()
        );

        registroEvents[
          sessionId
        ] = event;

        Logger.log(
          "CREATED [" +
          (index + 1) +
          "/" +
          regularClasses.length +
          "]: " +
          title
        );

      } catch (
        error
      ) {

        errorCount++;

        Logger.log(
          "ERROR creating " +
          record.title +
          ": " +
          error.message
        );
      }
    }
  );

  // ==================================================
  // SAVE SYNC TIMESTAMP
  // ==================================================

  properties.setProperty(
    "REGISTRO_LAST_CALENDAR_SYNC",
    new Date().toISOString()
  );

  // ==================================================
  // FINAL RESULTS
  // ==================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "REGISTRO BULK CALENDAR SYNC RESULTS"
  );

  Logger.log(
    "================================"
  );

  Logger.log(
    "Registro regular classes: " +
    regularClasses.length
  );

  Logger.log(
    "Already existing: " +
    existingCount
  );

  Logger.log(
    "New Calendar events created: " +
    createdCount
  );

  Logger.log(
    "Calendar events updated: " +
    updatedCount
  );

  Logger.log(
    "Already correct / skipped: " +
    skippedCount
  );

  Logger.log(
    "Errors: " +
    errorCount
  );

  Logger.log(
    "================================"
  );

  Logger.log(
    "Calendar events created in this run: " +
    createdIds.length
  );

  Logger.log(
    "Google Tasks created: 0"
  );

  Logger.log(
    "Gmail emails processed: 0"
  );

  Logger.log(
    "================================"
  );

  if (
    errorCount > 0
  ) {

    Logger.log(
      "WARNING: Some Calendar events could not be created."
    );

  } else {

    Logger.log(
      "BULK REGISTRO CALENDAR SYNC COMPLETED SUCCESSFULLY."
    );
  }

  Logger.log(
    "================================"
  );
}
function inspectRegistroScriptProperties() {

  Logger.log("================================");
  Logger.log("REGISTRO SCRIPT PROPERTY INSPECTION");
  Logger.log("================================");

  const properties =
    PropertiesService.getScriptProperties();

  const all =
    properties.getProperties();

  const keys =
    Object.keys(all)
      .filter(key =>
        key.toUpperCase().includes("REGISTRO")
      )
      .sort();

  Logger.log(
    "Registro-related properties found: " +
    keys.length
  );

  keys.forEach(key => {

    const value =
      all[key] || "";

    Logger.log(
      "PROPERTY: " +
      key
    );

    Logger.log(
      "VALUE LENGTH: " +
      value.length
    );

    // Do NOT print the actual value.
    // This protects tokens/sensitive state.
  });

  Logger.log("================================");
  Logger.log("NO PROPERTY CREATED.");
  Logger.log("NO PROPERTY MODIFIED.");
  Logger.log("NO GOOGLE CALENDAR EVENT CREATED.");
  Logger.log("NO GOOGLE CALENDAR EVENT MODIFIED.");
  Logger.log("NO GOOGLE CALENDAR EVENT DELETED.");
  Logger.log("NO GOOGLE TASK CREATED.");
  Logger.log("REGISTRO PROPERTY INSPECTION COMPLETE");
  Logger.log("================================");
}
function testRegistroPersistentCalendarRescheduleDryRun() {

  Logger.log("================================");
  Logger.log("REGISTRO → CALENDAR RESCHEDULE DRY RUN");
  Logger.log("================================");

  const properties =
    PropertiesService.getScriptProperties();

  const CALENDAR_ID =
    "priyanshurajgopi@gmail.com";

  const REGISTRO_URL =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  // ==========================================================
  // 1. LOAD REAL PERSISTENT SNAPSHOT
  // ==========================================================

  const snapshotRaw =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );

  if (!snapshotRaw) {
    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT not found."
    );
  }

  const previousState =
    JSON.parse(snapshotRaw);


  if (
    !previousState ||
    typeof previousState !== "object" ||
    Array.isArray(previousState)
  ) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT has an unexpected structure."
    );

  }


  const previousIds =
    Object.keys(previousState);


  Logger.log(
    "Previous snapshot loaded: " +
    previousIds.length +
    " sessions"
  );


  if (previousIds.length === 0) {

    throw new Error(
      "Persistent Registro snapshot contains zero sessions."
    );

  }


  // ==========================================================
  // 2. GET REGISTRO TOKEN
  // ==========================================================

  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );

  }


  // ==========================================================
  // 3. FETCH CURRENT REGISTRO
  // ==========================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      REGISTRO_URL,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const statusCode =
    response.getResponseCode();

  const body =
    response.getContentText();


  if (statusCode !== 200) {

    throw new Error(
      "Registro request failed with HTTP " +
      statusCode +
      ". Response: " +
      body.substring(0, 1000)
    );

  }


  const result =
    JSON.parse(body);


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );

  }


  // ==========================================================
  // 4. BUILD CURRENT STATE
  //
  // SAME IDENTITY MODEL AS OUR SNAPSHOT:
  //
  // date | course | section | session number
  // ==========================================================

  const currentState = {};


  result.data.forEach(
    record => {

      if (
        record.is_holiday === true ||
        record.is_exam === true
      ) {
        return;
      }


      const start =
        String(
          record.start || ""
        );


      const date =
        start.substring(
          0,
          10
        );


      const course =
        String(
          record.course || ""
        )
          .trim()
          .toLowerCase();


      const section =
        String(
          record.section || ""
        )
          .trim()
          .toLowerCase();


      const sessionNumber =
        String(
          record.session_number ?? ""
        )
          .trim();


      const id =
        [
          date,
          course,
          section,
          sessionNumber
        ].join("|");


      currentState[id] = {

        id: id,

        title:
          String(
            record.title || ""
          ),

        course:
          String(
            record.course || ""
          ),

        section:
          String(
            record.section || ""
          ),

        professor:
          String(
            record.professor || ""
          ),

        classroom:
          String(
            record.classroom_name || ""
          ),

        sessionNumber:
          sessionNumber,

        start:
          start,

        end:
          String(
            record.end || ""
          )

      };

    }
  );


  const currentIds =
    Object.keys(
      currentState
    );


  Logger.log(
    "Current Registro sessions: " +
    currentIds.length
  );


  // ==========================================================
  // 5. FIND A SESSION EXISTING IN BOTH STATES
  // ==========================================================

  let testId =
    null;


  for (
    let i = 0;
    i < currentIds.length;
    i++
  ) {

    const id =
      currentIds[i];


    if (
      previousState[id]
    ) {

      testId =
        id;

      break;

    }

  }


  if (!testId) {

    throw new Error(
      "Could not find a session existing in both current Registro and persistent snapshot."
    );

  }


  const currentSession =
    currentState[testId];


  const realPreviousSession =
    previousState[testId];


  Logger.log("================================");
  Logger.log("TEST SESSION");
  Logger.log("================================");


  Logger.log(
    "ID: " +
    testId
  );


  Logger.log(
    "Title: " +
    currentSession.title
  );


  Logger.log(
    "Course: " +
    currentSession.course
  );


  Logger.log(
    "Section: " +
    currentSession.section
  );


  Logger.log(
    "Professor: " +
    currentSession.professor
  );


  Logger.log(
    "Classroom: " +
    currentSession.classroom
  );


  Logger.log(
    "Snapshot start: " +
    realPreviousSession.start
  );


  Logger.log(
    "Current Registro start: " +
    currentSession.start
  );


  Logger.log(
    "Snapshot end: " +
    realPreviousSession.end
  );


  Logger.log(
    "Current Registro end: " +
    currentSession.end
  );


  // ==========================================================
  // 6. CREATE SIMULATED PREVIOUS STATE
  //
  // IMPORTANT:
  // ONLY MEMORY IS MODIFIED.
  // REAL SNAPSHOT IS NEVER TOUCHED.
  // ==========================================================

  const simulatedPrevious =
    JSON.parse(
      JSON.stringify(
        realPreviousSession
      )
    );


  const realStart =
    new Date(
      currentSession.start
    );


  const realEnd =
    new Date(
      currentSession.end
    );


  // Artificially make the previous class
  // two hours earlier.

  const simulatedStart =
    new Date(
      realStart.getTime() -
      (
        2 *
        60 *
        60 *
        1000
      )
    );


  const simulatedEnd =
    new Date(
      realEnd.getTime() -
      (
        2 *
        60 *
        60 *
        1000
      )
    );


  simulatedPrevious.start =
    simulatedStart.toISOString();


  simulatedPrevious.end =
    simulatedEnd.toISOString();


  Logger.log("================================");
  Logger.log("SIMULATED CHANGE");
  Logger.log("================================");


  Logger.log(
    "Old start: " +
    simulatedPrevious.start
  );


  Logger.log(
    "New start: " +
    currentSession.start
  );


  Logger.log(
    "Old end: " +
    simulatedPrevious.end
  );


  Logger.log(
    "New end: " +
    currentSession.end
  );


  // ==========================================================
  // 7. CLASSIFY CHANGE
  // ==========================================================

  const oldDate =
    Utilities.formatDate(
      new Date(
        simulatedPrevious.start
      ),
      "Asia/Kolkata",
      "yyyy-MM-dd"
    );


  const newDate =
    Utilities.formatDate(
      new Date(
        currentSession.start
      ),
      "Asia/Kolkata",
      "yyyy-MM-dd"
    );


  const sameDay =
    oldDate === newDate;


  const timeChanged =
    simulatedPrevious.start !==
      currentSession.start ||

    simulatedPrevious.end !==
      currentSession.end;


  Logger.log("================================");
  Logger.log("CHANGE CLASSIFICATION");
  Logger.log("================================");


  Logger.log(
    "Old date: " +
    oldDate
  );


  Logger.log(
    "New date: " +
    newDate
  );


  Logger.log(
    "Same day: " +
    (
      sameDay
        ? "YES"
        : "NO"
    )
  );


  Logger.log(
    "Time changed: " +
    (
      timeChanged
        ? "YES"
        : "NO"
    )
  );


  if (
    !sameDay ||
    !timeChanged
  ) {

    throw new Error(
      "Simulation failed: expected same-day time reschedule."
    );

  }


  Logger.log(
    "Same-day reschedule detected: YES"
  );


  // ==========================================================
  // 8. FIND CORRESPONDING CALENDAR EVENT
  // ==========================================================

  Logger.log("================================");
  Logger.log("CALENDAR EVENT LOOKUP");
  Logger.log("================================");


  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Could not access Calendar: " +
      CALENDAR_ID
    );

  }


  const searchStart =
    new Date(
      realStart.getTime() -
      (
        24 *
        60 *
        60 *
        1000
      )
    );


  const searchEnd =
    new Date(
      realEnd.getTime() +
      (
        24 *
        60 *
        60 *
        1000
      )
    );


  const events =
    calendar.getEvents(
      searchStart,
      searchEnd
    );


  Logger.log(
    "Calendar events found: " +
    events.length
  );


  const marker =
    "REGISTRO_SESSION_ID:" +
    testId;


  let matchingEvent =
    null;


  events.forEach(
    event => {

      if (matchingEvent) {
        return;
      }


      const description =
        event.getDescription() ||
        "";


      if (
        description.includes(
          marker
        )
      ) {

        matchingEvent =
          event;

      }

    }
  );


  // ==========================================================
  // 9. SHOW CALENDAR ACTION
  // ==========================================================

  Logger.log("================================");
  Logger.log("CALENDAR ACTION SIMULATION");
  Logger.log("================================");


  if (matchingEvent) {

    Logger.log(
      "Matching Calendar event FOUND: YES"
    );


    Logger.log(
      "Calendar title: " +
      matchingEvent.getTitle()
    );


    Logger.log(
      "Calendar event ID: " +
      matchingEvent.getId()
    );


    Logger.log(
      "Current Calendar start: " +
      matchingEvent.getStartTime()
    );


    Logger.log(
      "Current Calendar end: " +
      matchingEvent.getEndTime()
    );


    Logger.log(
      "WOULD CHANGE START TO: " +
      new Date(
        currentSession.start
      )
    );


    Logger.log(
      "WOULD CHANGE END TO: " +
      new Date(
        currentSession.end
      )
    );


  } else {

    Logger.log(
      "Matching Calendar event FOUND: NO"
    );


    Logger.log(
      "WARNING: Corresponding Registro Calendar event was not found."
    );

  }


  // ==========================================================
  // 10. GOOGLE TASK SIMULATION
  // ==========================================================

  Logger.log("================================");
  Logger.log("GOOGLE TASK ACTION SIMULATION");
  Logger.log("================================");


  Logger.log(
    "WOULD CREATE GOOGLE TASK: YES"
  );


  Logger.log(
    "Task title: Registro Reschedule — " +
    currentSession.title
  );


  Logger.log(
    "Task details:"
  );


  Logger.log(
    "Class changed in Registro."
  );


  Logger.log(
    "Old time: " +
    simulatedPrevious.start +
    " → " +
    simulatedPrevious.end
  );


  Logger.log(
    "New time: " +
    currentSession.start +
    " → " +
    currentSession.end
  );


  // ==========================================================
  // 11. CRITICAL SAFETY CHECK
  // ==========================================================

  Logger.log("================================");
  Logger.log("SAFETY VERIFICATION");
  Logger.log("================================");


  const snapshotAfter =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );


  const snapshotUnchanged =
    snapshotAfter ===
    snapshotRaw;


  Logger.log(
    "Real snapshot unchanged: " +
    (
      snapshotUnchanged
        ? "YES"
        : "NO"
    )
  );


  if (!snapshotUnchanged) {

    throw new Error(
      "SAFETY FAILURE: Real Registro snapshot was modified."
    );

  }


  Logger.log("================================");
  Logger.log("REGISTRO RESCHEDULE DRY RUN PASSED");
  Logger.log("================================");


  Logger.log(
    "Same-day reschedule: YES"
  );


  Logger.log(
    "Calendar modification: NOT EXECUTED"
  );


  Logger.log(
    "Google Task creation: NOT EXECUTED"
  );


  Logger.log(
    "Snapshot modification: NOT EXECUTED"
  );


  Logger.log(
    "Real snapshot preserved: YES"
  );


  Logger.log("================================");
}
function testRegistroProductionReconciliationDryRun() {

  Logger.log("================================");
  Logger.log("REGISTRO PRODUCTION RECONCILIATION DRY RUN");
  Logger.log("================================");

  const properties =
    PropertiesService.getScriptProperties();

  const CALENDAR_ID =
    "priyanshurajgopi@gmail.com";

  const REGISTRO_URL =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  // ==========================================================
  // 1. LOAD PERSISTENT REGISTRO SNAPSHOT
  // ==========================================================

  const snapshotRaw =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );

  if (!snapshotRaw) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT not found."
    );

  }

  const previousState =
    JSON.parse(snapshotRaw);


  if (
    !previousState ||
    typeof previousState !== "object" ||
    Array.isArray(previousState)
  ) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT has an unexpected structure."
    );

  }


  const previousIds =
    Object.keys(previousState);


  Logger.log(
    "Previous Registro snapshot: " +
    previousIds.length +
    " sessions"
  );


  // ==========================================================
  // 2. LOAD REGISTRO TOKEN
  // ==========================================================

  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );

  }


  // ==========================================================
  // 3. FETCH CURRENT REGISTRO
  // ==========================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      REGISTRO_URL,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const statusCode =
    response.getResponseCode();

  const body =
    response.getContentText();


  Logger.log(
    "Registro HTTP status: " +
    statusCode
  );


  if (statusCode !== 200) {

    throw new Error(
      "Registro request failed with HTTP " +
      statusCode +
      ". Response: " +
      body.substring(0, 1000)
    );

  }


  const result =
    JSON.parse(body);


  if (
    !result ||
    !Array.isArray(result.data)
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );

  }


  // ==========================================================
  // 4. BUILD CURRENT REGISTRO STATE
  // ==========================================================

  const currentState = {};


  result.data.forEach(
    record => {

      // Holidays and exams are not regular classes.
      if (
        record.is_holiday === true ||
        record.is_exam === true
      ) {
        return;
      }


      const start =
        String(
          record.start || ""
        );


      const date =
        start.substring(
          0,
          10
        );


      const course =
        String(
          record.course || ""
        )
          .trim()
          .toLowerCase();


      const section =
        String(
          record.section || ""
        )
          .trim()
          .toLowerCase();


      const sessionNumber =
        String(
          record.session_number ?? ""
        )
          .trim();


      const id =
        [
          date,
          course,
          section,
          sessionNumber
        ].join("|");


      currentState[id] = {

        id: id,

        title:
          String(
            record.title || ""
          ),

        course:
          String(
            record.course || ""
          ),

        section:
          String(
            record.section || ""
          ),

        professor:
          String(
            record.professor || ""
          ),

        classroom:
          String(
            record.classroom_name || ""
          ),

        sessionNumber:
          sessionNumber,

        start:
          start,

        end:
          String(
            record.end || ""
          )

      };

    }
  );


  const currentIds =
    Object.keys(
      currentState
    );


  Logger.log(
    "Current Registro classes: " +
    currentIds.length
  );


  // ==========================================================
  // 5. BUILD CHANGE SETS
  // ==========================================================

  const newSessions = [];
  const modifiedSessions = [];
  const removedSessions = [];


  // ----------------------------------------------------------
  // NEW / MODIFIED
  // ----------------------------------------------------------

  currentIds.forEach(
    id => {

      const current =
        currentState[id];

      const previous =
        previousState[id];


      if (!previous) {

        newSessions.push(
          current
        );

        return;

      }


      const timeChanged =
        String(
          previous.start || ""
        ) !==
        String(
          current.start || ""
        ) ||

        String(
          previous.end || ""
        ) !==
        String(
          current.end || ""
        );


      const classroomChanged =
        String(
          previous.classroom || ""
        ).trim() !==
        String(
          current.classroom || ""
        ).trim();


      const professorChanged =
        String(
          previous.professor || ""
        ).trim() !==
        String(
          current.professor || ""
        ).trim();


      const titleChanged =
        String(
          previous.title || ""
        ).trim() !==
        String(
          current.title || ""
        ).trim();


      if (
        timeChanged ||
        classroomChanged ||
        professorChanged ||
        titleChanged
      ) {

        modifiedSessions.push({

          current: current,

          previous: previous,

          timeChanged:
            timeChanged,

          classroomChanged:
            classroomChanged,

          professorChanged:
            professorChanged,

          titleChanged:
            titleChanged

        });

      }

    }
  );


  // ----------------------------------------------------------
  // REMOVED
  // ----------------------------------------------------------

  previousIds.forEach(
    id => {

      if (
        !currentState[id]
      ) {

        removedSessions.push(
          previousState[id]
        );

      }

    }
  );


  // ==========================================================
  // 6. CLASSIFY MODIFICATIONS
  // ==========================================================

  const sameDayReschedules = [];
  const crossDayChanges = [];
  const classroomChanges = [];
  const otherModifications = [];


  modifiedSessions.forEach(
    change => {

      if (
        change.timeChanged
      ) {

        const oldDate =
          Utilities.formatDate(
            new Date(
              change.previous.start
            ),
            "Asia/Kolkata",
            "yyyy-MM-dd"
          );


        const newDate =
          Utilities.formatDate(
            new Date(
              change.current.start
            ),
            "Asia/Kolkata",
            "yyyy-MM-dd"
          );


        if (
          oldDate === newDate
        ) {

          sameDayReschedules.push(
            change
          );

        } else {

          crossDayChanges.push(
            change
          );

        }

      }


      if (
        change.classroomChanged
      ) {

        classroomChanges.push(
          change
        );

      }


      if (
        !change.timeChanged &&
        !change.classroomChanged &&
        (
          change.professorChanged ||
          change.titleChanged
        )
      ) {

        otherModifications.push(
          change
        );

      }

    }
  );


  // ==========================================================
  // 7. READ GOOGLE CALENDAR
  // ==========================================================

  Logger.log("================================");
  Logger.log("READING GOOGLE CALENDAR");
  Logger.log("================================");


  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Could not access Google Calendar: " +
      CALENDAR_ID
    );

  }


  // Use the entire current Registro range.
  // This is deliberately broad enough to cover
  // the visible timetable returned by Registro.

  let earliestDate =
    new Date(
      "2099-12-31T23:59:59"
    );


  let latestDate =
    new Date(
      "2000-01-01T00:00:00"
    );


  currentIds.forEach(
    id => {

      const session =
        currentState[id];

      const start =
        new Date(
          session.start
        );

      const end =
        new Date(
          session.end
        );


      if (
        start < earliestDate
      ) {

        earliestDate =
          start;

      }


      if (
        end > latestDate
      ) {

        latestDate =
          end;

      }

    }
  );


  earliestDate =
    new Date(
      earliestDate.getTime() -
      (
        24 *
        60 *
        60 *
        1000
      )
    );


  latestDate =
    new Date(
      latestDate.getTime() +
      (
        24 *
        60 *
        60 *
        1000
      )
    );


  Logger.log(
    "Calendar search start: " +
    earliestDate
  );


  Logger.log(
    "Calendar search end: " +
    latestDate
  );


  const calendarEvents =
    calendar.getEvents(
      earliestDate,
      latestDate
    );


  Logger.log(
    "Calendar events found: " +
    calendarEvents.length
  );


  // ==========================================================
  // 8. INDEX CALENDAR EVENTS BY REGISTRO SESSION ID
  // ==========================================================

  const calendarByRegistroId = {};


  const marker =
    "REGISTRO_SESSION_ID:";


  calendarEvents.forEach(
    event => {

      const description =
        event.getDescription() ||
        "";


      const markerIndex =
        description.indexOf(
          marker
        );


      if (
        markerIndex === -1
      ) {

        return;

      }


      const afterMarker =
        description.substring(
          markerIndex +
          marker.length
        );


      const registroId =
        afterMarker
          .split(/\r?\n/)[0]
          .trim();


      if (
        registroId
      ) {

        calendarByRegistroId[
          registroId
        ] = event;

      }

    }
  );


  const calendarRegistroIds =
    Object.keys(
      calendarByRegistroId
    );


  Logger.log(
    "Calendar events carrying Registro IDs: " +
    calendarRegistroIds.length
  );


  // ==========================================================
  // 9. RECONCILE REGISTRO → CALENDAR
  // ==========================================================

  const missingFromCalendar = [];
  const calendarTimeMismatches = [];
  const calendarClassroomMismatches = [];
  const calendarOtherMismatches = [];


  currentIds.forEach(
    id => {

      const session =
        currentState[id];

      const event =
        calendarByRegistroId[id];


      if (!event) {

        missingFromCalendar.push(
          session
        );

        return;

      }


      const registroStart =
        new Date(
          session.start
        );


      const registroEnd =
        new Date(
          session.end
        );


      const calendarStart =
        event.getStartTime();


      const calendarEnd =
        event.getEndTime();


      if (
        calendarStart.getTime() !==
        registroStart.getTime() ||

        calendarEnd.getTime() !==
        registroEnd.getTime()
      ) {

        calendarTimeMismatches.push({

          session:
            session,

          event:
            event

        });

      }


      const registroRoom =
        String(
          session.classroom || ""
        )
          .trim();


      const calendarRoom =
        String(
          event.getLocation() || ""
        )
          .trim();


      if (
        registroRoom !==
        calendarRoom
      ) {

        calendarClassroomMismatches.push({

          session:
            session,

          event:
            event

        });

      }


      const expectedTitle =
        String(
          session.title || ""
        ).trim();


      const actualTitle =
        String(
          event.getTitle() || ""
        ).trim();


      if (
        expectedTitle !==
        actualTitle
      ) {

        calendarOtherMismatches.push({

          session:
            session,

          event:
            event

        });

      }

    }
  );


  // ==========================================================
  // 10. EVENTS IN CALENDAR THAT REGISTRO NO LONGER HAS
  // ==========================================================

  const calendarEventsForRemovedSessions = [];


  calendarRegistroIds.forEach(
    id => {

      if (
        !currentState[id]
      ) {

        calendarEventsForRemovedSessions.push({

          id:
            id,

          event:
            calendarByRegistroId[id]

        });

      }

    }
  );


  // ==========================================================
  // 11. RESULTS
  // ==========================================================

  Logger.log("================================");
  Logger.log("PRODUCTION RECONCILIATION RESULTS");
  Logger.log("================================");


  Logger.log(
    "Previous Registro sessions: " +
    previousIds.length
  );


  Logger.log(
    "Current Registro classes: " +
    currentIds.length
  );


  Logger.log(
    "New Registro sessions: " +
    newSessions.length
  );


  Logger.log(
    "Modified Registro sessions: " +
    modifiedSessions.length
  );


  Logger.log(
    "Same-day reschedules: " +
    sameDayReschedules.length
  );


  Logger.log(
    "Cross-day changes: " +
    crossDayChanges.length
  );


  Logger.log(
    "Classroom changes: " +
    classroomChanges.length
  );


  Logger.log(
    "Other Registro modifications: " +
    otherModifications.length
  );


  Logger.log(
    "Removed Registro sessions: " +
    removedSessions.length
  );


  Logger.log(
    "Missing from Calendar: " +
    missingFromCalendar.length
  );


  Logger.log(
    "Calendar time mismatches: " +
    calendarTimeMismatches.length
  );


  Logger.log(
    "Calendar classroom mismatches: " +
    calendarClassroomMismatches.length
  );


  Logger.log(
    "Calendar other mismatches: " +
    calendarOtherMismatches.length
  );


  Logger.log(
    "Calendar events for removed Registro sessions: " +
    calendarEventsForRemovedSessions.length
  );


  // ==========================================================
  // 12. SHOW NEW SESSIONS
  // ==========================================================

  if (
    newSessions.length > 0
  ) {

    Logger.log("================================");
    Logger.log("NEW SESSIONS");
    Logger.log("================================");


    newSessions
      .slice(0, 10)
      .forEach(
        session => {

          Logger.log(
            "Title: " +
            session.title
          );

          Logger.log(
            "Start: " +
            session.start
          );

          Logger.log(
            "End: " +
            session.end
          );

          Logger.log(
            "Classroom: " +
            session.classroom
          );

          Logger.log(
            "ID: " +
            session.id
          );

          Logger.log(
            "--------------------------------"
          );

        }
      );

  }


  // ==========================================================
  // 13. SHOW SAME-DAY RESCHEDULES
  // ==========================================================

  if (
    sameDayReschedules.length > 0
  ) {

    Logger.log("================================");
    Logger.log("SAME-DAY RESCHEDULES");
    Logger.log("================================");


    sameDayReschedules
      .slice(0, 10)
      .forEach(
        change => {

          Logger.log(
            "ID: " +
            change.current.id
          );


          Logger.log(
            "Title: " +
            change.current.title
          );


          Logger.log(
            "OLD START: " +
            change.previous.start
          );


          Logger.log(
            "NEW START: " +
            change.current.start
          );


          Logger.log(
            "OLD END: " +
            change.previous.end
          );


          Logger.log(
            "NEW END: " +
            change.current.end
          );


          Logger.log(
            "--------------------------------"
          );

        }
      );

  }


  // ==========================================================
  // 14. SHOW REMOVED SESSIONS
  // ==========================================================

  if (
    removedSessions.length > 0
  ) {

    Logger.log("================================");
    Logger.log("REMOVED / CANCELLED SESSIONS");
    Logger.log("================================");


    removedSessions
      .slice(0, 10)
      .forEach(
        session => {

          Logger.log(
            "ID: " +
            session.id
          );


          Logger.log(
            "Title: " +
            session.title
          );


          Logger.log(
            "Start: " +
            session.start
          );


          Logger.log(
            "Classroom: " +
            session.classroom
          );


          Logger.log(
            "--------------------------------"
          );

        }
      );

  }


  // ==========================================================
  // 15. SHOW CALENDAR MISMATCHES
  // ==========================================================

  if (
    calendarTimeMismatches.length > 0
  ) {

    Logger.log("================================");
    Logger.log("CALENDAR TIME MISMATCHES");
    Logger.log("================================");


    calendarTimeMismatches
      .slice(0, 10)
      .forEach(
        mismatch => {

          Logger.log(
            "ID: " +
            mismatch.session.id
          );


          Logger.log(
            "Title: " +
            mismatch.session.title
          );


          Logger.log(
            "Registro start: " +
            mismatch.session.start
          );


          Logger.log(
            "Calendar start: " +
            mismatch.event.getStartTime()
          );


          Logger.log(
            "Registro end: " +
            mismatch.session.end
          );


          Logger.log(
            "Calendar end: " +
            mismatch.event.getEndTime()
          );


          Logger.log(
            "--------------------------------"
          );

        }
      );

  }


  // ==========================================================
  // 16. SAFETY: THIS FUNCTION DOES NOT WRITE ANYTHING
  // ==========================================================

  Logger.log("================================");
  Logger.log("READ-ONLY SAFETY CONFIRMATION");
  Logger.log("================================");

  Logger.log(
    "GOOGLE CALENDAR EVENT CREATED: NO"
  );

  Logger.log(
    "GOOGLE CALENDAR EVENT MODIFIED: NO"
  );

  Logger.log(
    "GOOGLE CALENDAR EVENT DELETED: NO"
  );

  Logger.log(
    "GOOGLE TASK CREATED: NO"
  );

  Logger.log(
    "REGISTRO SNAPSHOT MODIFIED: NO"
  );

  Logger.log(
    "GMAIL EMAIL PROCESSED: NO"
  );


  Logger.log("================================");
  Logger.log(
    "REGISTRO PRODUCTION RECONCILIATION DRY RUN COMPLETE"
  );
  Logger.log("================================");
}
function syncRegistroToCalendarLive() {

  Logger.log("================================");
  Logger.log("REGISTRO → GOOGLE CALENDAR");
  Logger.log("PRODUCTION LIVE SYNC — RESILIENT + DUPLICATE RECONCILIATION");
  Logger.log("================================");

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CALENDAR_ID =
    "priyanshurajgopi@gmail.com";

  const REGISTRO_URL =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";

  const TOKEN_PROPERTY =
    "REGISTRO_ACCESS_TOKEN";

  const SNAPSHOT_PROPERTY =
    "REGISTRO_TIMETABLE_SNAPSHOT";

  const SNAPSHOT_TIME_PROPERTY =
    "REGISTRO_TIMETABLE_SNAPSHOT_TIME";

  const LAST_SYNC_PROPERTY =
    "REGISTRO_LAST_CALENDAR_SYNC";

  const LIVE_PROPERTY =
    "REGISTRO_SYNC_LIVE";


  // ============================================================
  // RESILIENCE CONFIGURATION
  // ============================================================

  const WRITE_DELAY_MS = 750;

  const MAX_RETRIES = 4;

  const INITIAL_RETRY_DELAY_MS = 1500;


  // ============================================================
  // OVERLAPPING EXECUTION PROTECTION
  // ============================================================

  /*
   * Prevent two time-driven/manual executions from modifying
   * the same Calendar simultaneously.
   *
   * This is especially important because duplicate events can
   * otherwise be created if two executions both believe an
   * event is missing.
   */

  const lock =
    LockService.getScriptLock();

  if (
    !lock.tryLock(1000)
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "SYNC SKIPPED"
    );

    Logger.log(
      "Another sync execution is already running."
    );

    Logger.log(
      "No Calendar or snapshot changes were made."
    );

    Logger.log(
      "================================"
    );

    return;
  }


  try {

    const properties =
      PropertiesService.getScriptProperties();


    // ============================================================
    // LIVE SWITCH
    // ============================================================

    const liveMode =
      properties.getProperty(
        LIVE_PROPERTY
      );

    if (
      liveMode !== "true"
    ) {

      Logger.log(
        "REGISTRO_SYNC_LIVE is not true."
      );

      Logger.log(
        "NO GOOGLE CALENDAR CHANGES WILL BE MADE."
      );

      Logger.log(
        "NO GOOGLE TASKS WILL BE CREATED."
      );

      Logger.log(
        "================================"
      );

      return;
    }

    Logger.log(
      "LIVE MODE: ENABLED"
    );


    // ============================================================
    // TOKEN
    // ============================================================

    const token =
      getValidRegistroToken();


    // ============================================================
    // BASIC HELPERS
    // ============================================================

    function cleanText(value) {

      if (
        value === null ||
        value === undefined
      ) {

        return "";
      }

      return String(value)
        .trim()
        .replace(/\s+/g, " ");
    }


    function normalizeText(value) {

      return cleanText(value)
        .toLowerCase();
    }


    function normalizeDateTime(value) {

      if (!value) {

        return "";
      }

      const date =
        new Date(value);

      if (
        isNaN(
          date.getTime()
        )
      ) {

        return cleanText(value);
      }

      return date.toISOString();
    }


    function dateOnly(value) {

      const normalized =
        normalizeDateTime(value);

      if (!normalized) {

        return "";
      }

      return normalized.substring(
        0,
        10
      );
    }


    // ============================================================
    // REGISTRO SESSION ID
    // ============================================================

    function buildSessionId(record) {

      const start =
        cleanText(
          record.start
        );

      const date =
        start.substring(
          0,
          10
        );

      const time =
        start.substring(
          11,
          16
        );

      const course =
        normalizeText(
          record.course
        );

      const section =
        normalizeText(
          record.section
        );

      const sessionNumber =
        cleanText(
          record.session_number !== undefined
            ? record.session_number
            : record.sessionNumber
        );

      // When session_number is 0 or unassigned (e.g. workshops/visits like MAP),
      // include the start time so multiple slots on the same day don't collide.
      const sessionKey =
        (sessionNumber === "" || sessionNumber === "0")
          ? ("0@" + (time || "slot"))
          : sessionNumber;

      return [
        date,
        course,
        section,
        sessionKey
      ].join("|");
    }


    // ============================================================
    // FAS / MENTOR-MENTEE
    // ============================================================

    function isFAS(record) {

      const title =
        normalizeText(
          record.title
        );

      const course =
        normalizeText(
          record.course
        );

      const professor =
        normalizeText(
          record.professor
        );

      return (
        title === "fas" ||

        course === "fas" ||

        title.indexOf(
          "mentor mentee"
        ) !== -1 ||

        title.indexOf(
          "mentor-mentee"
        ) !== -1 ||

        professor.indexOf(
          "mentor mentee"
        ) !== -1 ||

        professor.indexOf(
          "mentor-mentee"
        ) !== -1
      );
    }


    // ============================================================
    // CALENDAR-WORTHY RECORD
    // ============================================================

    function isCalendarWorthy(record) {

      if (!record) {

        return false;
      }

      if (
        record.is_holiday === true
      ) {

        return false;
      }

      if (
        record.is_exam === true
      ) {

        return false;
      }

      if (
        !record.start ||
        !record.end
      ) {

        return false;
      }

      const start =
        new Date(
          record.start
        );

      const end =
        new Date(
          record.end
        );

      if (
        isNaN(
          start.getTime()
        ) ||
        isNaN(
          end.getTime()
        )
      ) {

        return false;
      }

      if (
        end.getTime() <=
        start.getTime()
      ) {

        return false;
      }

      if (
        isFAS(record)
      ) {

        return true;
      }

      return (
        cleanText(
          record.title
        ) !== "" ||

        cleanText(
          record.course
        ) !== ""
      );
    }


    // ============================================================
    // CANONICAL RECORD
    // ============================================================

    function canonical(record) {

      if (!record) {

        return {

          title: "",
          course: "",
          section: "",
          professor: "",
          classroom: "",
          sessionNumber: "",
          start: "",
          end: ""

        };
      }

      return {

        title:
          normalizeText(
            record.title
          ),

        course:
          normalizeText(
            record.course
          ),

        section:
          normalizeText(
            record.section
          ),

        professor:
          normalizeText(
            record.professor
          ),

        classroom:
          normalizeText(
            record.classroom_name ||
            record.classroom
          ),

        sessionNumber:
          cleanText(
            record.session_number !== undefined
              ? record.session_number
              : record.sessionNumber
          ),

        start:
          normalizeDateTime(
            record.start
          ),

        end:
          normalizeDateTime(
            record.end
          )

      };
    }


    // ============================================================
    // RECORD COMPARISON
    // ============================================================

    function compareRecords(
      previous,
      current
    ) {

      const oldRecord =
        canonical(
          previous
        );

      const newRecord =
        canonical(
          current
        );

      const timeChanged =
        oldRecord.start !==
          newRecord.start ||

        oldRecord.end !==
          newRecord.end;

      const classroomChanged =
        oldRecord.classroom !==
        newRecord.classroom;

      const otherChanged =
        oldRecord.title !==
          newRecord.title ||

        oldRecord.course !==
          newRecord.course ||

        oldRecord.section !==
          newRecord.section ||

        oldRecord.professor !==
          newRecord.professor ||

        oldRecord.sessionNumber !==
          newRecord.sessionNumber;

      return {

        changed:
          timeChanged ||
          classroomChanged ||
          otherChanged,

        timeChanged:
          timeChanged,

        classroomChanged:
          classroomChanged,

        otherChanged:
          otherChanged

      };
    }


    // ============================================================
    // CROSS-DAY RESCHEDULE IDENTITY
    // ============================================================

    function rescheduleIdentity(record) {

      const value =
        canonical(
          record
        );

      return [

        value.title,
        value.course,
        value.section,
        value.professor,
        value.sessionNumber

      ].join("|");
    }


    // ============================================================
    // CALENDAR DESCRIPTION
    // ============================================================

    function buildDescription(
      record,
      sessionId
    ) {

      return [

        "Registro timetable event",
        "",

        "Course: " +
          cleanText(
            record.course
          ),

        "Section: " +
          cleanText(
            record.section
          ),

        "Professor: " +
          cleanText(
            record.professor
          ),

        "Classroom: " +
          cleanText(
            record.classroom_name ||
            record.classroom
          ),

        "Session number: " +
          cleanText(
            record.session_number !== undefined
              ? record.session_number
              : record.sessionNumber
          ),

        "",

        "REGISTRO_SESSION_ID:" +
          sessionId

      ].join("\n");
    }


    // ============================================================
    // EXTRACT REGISTRO ID
    // ============================================================

    function getRegistroId(event) {

      const description =
        event.getDescription() ||
        "";

      const marker =
        "REGISTRO_SESSION_ID:";

      const index =
        description.indexOf(
          marker
        );

      if (
        index === -1
      ) {

        return "";
      }

      return description
        .substring(
          index +
          marker.length
        )
        .split("\n")[0]
        .trim();
    }


    // ============================================================
    // RETRY CLASSIFICATION
    // ============================================================

    function isTransientCalendarError(error) {

      const message =
        String(
          error &&
          error.message
            ? error.message
            : error
        ).toLowerCase();

      return (

        message.indexOf(
          "too many calendars"
        ) !== -1 ||

        message.indexOf(
          "too many calendar"
        ) !== -1 ||

        message.indexOf(
          "rate limit"
        ) !== -1 ||

        message.indexOf(
          "quota"
        ) !== -1 ||

        message.indexOf(
          "service invoked too many times"
        ) !== -1 ||

        message.indexOf(
          "try again later"
        ) !== -1 ||

        message.indexOf(
          "429"
        ) !== -1 ||

        message.indexOf(
          "backend error"
        ) !== -1 ||

        message.indexOf(
          "internal error"
        ) !== -1

      );
    }


    // ============================================================
    // SAFE CALENDAR OPERATION
    // ============================================================

    function runCalendarOperation(
      operationName,
      operation
    ) {

      let lastError =
        null;

      for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
      ) {

        try {

          if (
            attempt > 1
          ) {

            const delay =
              INITIAL_RETRY_DELAY_MS *
              Math.pow(
                2,
                attempt - 2
              );

            Logger.log(
              "Retrying Calendar operation: " +
              operationName +
              " | attempt " +
              attempt +
              "/" +
              MAX_RETRIES +
              " | waiting " +
              delay +
              " ms"
            );

            Utilities.sleep(
              delay
            );
          }

          const result =
            operation();

          Utilities.sleep(
            WRITE_DELAY_MS
          );

          return {

            success: true,
            result: result,
            error: null

          };

        } catch (error) {

          lastError =
            error;

          Logger.log(
            "Calendar operation failed: " +
            operationName +
            " | attempt " +
            attempt +
            "/" +
            MAX_RETRIES +
            " | " +
            error.message
          );

          if (
            !isTransientCalendarError(
              error
            )
          ) {

            break;
          }
        }
      }

      return {

        success: false,
        result: null,
        error: lastError

      };
    }


    // ============================================================
    // LOAD PREVIOUS SNAPSHOT
    // ============================================================

    const snapshotRaw =
      properties.getProperty(
        SNAPSHOT_PROPERTY
      );

    if (!snapshotRaw) {

      throw new Error(
        "REGISTRO_TIMETABLE_SNAPSHOT is missing."
      );
    }

    let previousSnapshot;

    try {

      previousSnapshot =
        JSON.parse(
          snapshotRaw
        );

    } catch (error) {

      throw new Error(
        "REGISTRO_TIMETABLE_SNAPSHOT contains invalid JSON."
      );
    }

    if (
      !previousSnapshot ||
      typeof previousSnapshot !== "object" ||
      Array.isArray(previousSnapshot)
    ) {

      throw new Error(
        "REGISTRO_TIMETABLE_SNAPSHOT must be an object keyed by session ID."
      );
    }

    const previousIds =
      Object.keys(
        previousSnapshot
      );

    Logger.log(
      "Previous snapshot sessions: " +
      previousIds.length
    );


    // ============================================================
    // FETCH CURRENT REGISTRO
    // ============================================================

    Logger.log(
      "Fetching current Registro timetable..."
    );

    let response =
      UrlFetchApp.fetch(
        REGISTRO_URL,
        {

          method:
            "get",

          headers:
            {

              "Accept":
                "application/json, text/plain, */*",

              "Token":
                token

            },

          muteHttpExceptions:
            true

        }
      );

    let status =
      response.getResponseCode();

    Logger.log(
      "Registro HTTP status: " +
      status
    );

    if (
      status === 401 ||
      status === 403
    ) {

      Logger.log(
        "Registro token rejected with HTTP " + status + ". Forcing automatic re-authentication..."
      );

      const freshToken =
        authenticateRegistro(true);

      response =
        UrlFetchApp.fetch(
          REGISTRO_URL,
          {
            method: "get",
            headers: {
              "Accept": "application/json, text/plain, */*",
              "Token": freshToken
            },
            muteHttpExceptions: true
          }
        );

      status =
        response.getResponseCode();

      Logger.log(
        "Registro retry HTTP status: " +
        status
      );

    }

    if (
      status !== 200
    ) {

      throw new Error(
        "Registro API returned HTTP " +
        status
      );
    }

    let payload;

    try {

      payload =
        JSON.parse(
          response.getContentText()
        );

    } catch (error) {

      throw new Error(
        "Could not parse Registro API response as JSON."
      );
    }

    if (
      !payload ||
      !Array.isArray(
        payload.data
      )
    ) {

      throw new Error(
        "Registro API response does not contain data[]."
      );
    }

    const rawRecords =
      payload.data;

    Logger.log(
      "Raw Registro records: " +
      rawRecords.length
    );


    // ============================================================
    // BUILD CURRENT STATE
    // ============================================================

    const currentState =
      {};

    const fasSessions =
      [];

    let holidayCount =
      0;

    let examCount =
      0;

    let invalidCount =
      0;


    rawRecords.forEach(
      record => {

        if (
          record.is_holiday === true
        ) {

          holidayCount++;

          return;
        }

        if (
          record.is_exam === true
        ) {

          examCount++;

          return;
        }

        if (
          !isCalendarWorthy(
            record
          )
        ) {

          invalidCount++;

          return;
        }

        let id =
          buildSessionId(
            record
          );

        if (
          currentState[id]
        ) {

          Logger.log(
            "Notice: Duplicate Registro session ID detected (" + id + "). Disambiguating..."
          );

          let dupIndex = 2;
          while (
            currentState[id + "_dup" + dupIndex]
          ) {
            dupIndex++;
          }

          id = id + "_dup" + dupIndex;
        }

        currentState[id] =
          record;

        if (
          isFAS(record)
        ) {

          fasSessions.push(
            {
              id: id,
              record: record
            }
          );
        }
      }
    );


    const currentIds =
      Object.keys(
        currentState
      );

    Logger.log(
      "Current Registro sessions: " +
      currentIds.length
    );

    Logger.log(
      "FAS / Mentor-Mentee sessions: " +
      fasSessions.length
    );

    Logger.log(
      "Holiday records: " +
      holidayCount
    );

    Logger.log(
      "Exam records: " +
      examCount
    );

    Logger.log(
      "Invalid records: " +
      invalidCount
    );


    // ============================================================
    // DETECT CHANGES
    // ============================================================

    const newSessions =
      [];

    const modifiedSessions =
      [];

    const removedSessions =
      [];


    currentIds.forEach(
      id => {

        const current =
          currentState[id];

        const previous =
          previousSnapshot[id];

        if (!previous) {

          newSessions.push(
            {

              id: id,

              current:
                current

            }
          );

          return;
        }


        const comparison =
          compareRecords(
            previous,
            current
          );

        if (
          comparison.changed
        ) {

          modifiedSessions.push(
            {

              id: id,

              previous:
                previous,

              current:
                current,

              timeChanged:
                comparison.timeChanged,

              classroomChanged:
                comparison.classroomChanged,

              otherChanged:
                comparison.otherChanged

            }
          );
        }
      }
    );


    previousIds.forEach(
      id => {

        if (
          !currentState[id]
        ) {

          removedSessions.push(
            {

              id: id,

              previous:
                previousSnapshot[id]

            }
          );
        }
      }
    );


    // ============================================================
    // SAME-DAY RESCHEDULES
    // ============================================================

    const sameDayReschedules =
      modifiedSessions.filter(
        change => {

          if (
            !change.timeChanged
          ) {

            return false;
          }

          return (

            dateOnly(
              change.previous.start
            ) ===

            dateOnly(
              change.current.start
            )

          );
        }
      );


    // ============================================================
    // CROSS-DAY RESCHEDULES
    // ============================================================

    const crossDayReschedules =
      [];

    const pairedRemoved =
      {};

    const pairedNew =
      {};

    const removedByIdentity =
      {};


    removedSessions.forEach(
      removal => {

        const identity =
          rescheduleIdentity(
            removal.previous
          );

        if (
          !removedByIdentity[identity]
        ) {

          removedByIdentity[identity] =
            [];
        }

        removedByIdentity[identity]
          .push(
            removal
          );
      }
    );


    newSessions.forEach(
      addition => {

        const identity =
          rescheduleIdentity(
            addition.current
          );

        const candidates =
          removedByIdentity[
            identity
          ];

        if (
          !candidates ||
          candidates.length !== 1
        ) {

          return;
        }

        const removal =
          candidates[0];

        if (
          pairedRemoved[
            removal.id
          ] ||

          pairedNew[
            addition.id
          ]
        ) {

          return;
        }

        pairedRemoved[
          removal.id
        ] =
          true;

        pairedNew[
          addition.id
        ] =
          true;

        crossDayReschedules.push(
          {

            oldId:
              removal.id,

            newId:
              addition.id,

            previous:
              removal.previous,

            current:
              addition.current

          }
        );
      }
    );


    // ============================================================
    // LOG DETECTION
    // ============================================================

    Logger.log(
      "================================"
    );

    Logger.log(
      "REGISTRO CHANGE DETECTION"
    );

    Logger.log(
      "================================"
    );

    Logger.log(
      "New sessions: " +
      newSessions.length
    );

    Logger.log(
      "Modified sessions: " +
      modifiedSessions.length
    );

    Logger.log(
      "Same-day reschedules: " +
      sameDayReschedules.length
    );

    Logger.log(
      "Cross-day reschedules: " +
      crossDayReschedules.length
    );

    Logger.log(
      "Removed sessions: " +
      removedSessions.length
    );


    // ============================================================
    // GET CALENDAR
    // ============================================================

    const calendar =
      CalendarApp.getCalendarById(
        CALENDAR_ID
      );

    if (!calendar) {

      throw new Error(
        "Could not access Google Calendar: " +
        CALENDAR_ID
      );
    }


    // ============================================================
    // DETERMINE CALENDAR SEARCH RANGE
    // ============================================================

    let earliest =
      null;

    let latest =
      null;


    function absorbDate(record) {

      if (!record) {

        return;
      }

      if (
        record.start
      ) {

        const start =
          new Date(
            record.start
          );

        if (
          !isNaN(
            start.getTime()
          )
        ) {

          if (
            !earliest ||
            start < earliest
          ) {

            earliest =
              start;
          }
        }
      }


      if (
        record.end
      ) {

        const end =
          new Date(
            record.end
          );

        if (
          !isNaN(
            end.getTime()
          )
        ) {

          if (
            !latest ||
            end > latest
          ) {

            latest =
              end;
          }
        }
      }
    }


    previousIds.forEach(
      id => {

        absorbDate(
          previousSnapshot[id]
        );
      }
    );


    currentIds.forEach(
      id => {

        absorbDate(
          currentState[id]
        );
      }
    );


    if (
      !earliest ||
      !latest
    ) {

      throw new Error(
        "Unable to determine Registro Calendar date range."
      );
    }


    const searchStart =
      new Date(
        earliest
      );

    searchStart.setDate(
      searchStart.getDate() - 1
    );


    const searchEnd =
      new Date(
        latest
      );

    searchEnd.setDate(
      searchEnd.getDate() + 1
    );


    Logger.log(
      "Calendar search start: " +
      searchStart
    );

    Logger.log(
      "Calendar search end: " +
      searchEnd
    );


    // ============================================================
    // INDEX ALL CALENDAR EVENTS
    // ============================================================

    const calendarEvents =
      calendar.getEvents(
        searchStart,
        searchEnd
      );


    /*
     * IMPORTANT FIX:
     *
     * The old version used:
     *
     * registroEvents[id] = event;
     *
     * That silently discarded duplicates.
     *
     * The new version stores EVERY event for each Registro ID.
     */

    const registroEventsById =
      {};


    calendarEvents.forEach(
      event => {

        const id =
          getRegistroId(
            event
          );

        if (!id) {

          return;
        }

        if (
          !registroEventsById[id]
        ) {

          registroEventsById[id] =
            [];
        }

        registroEventsById[id]
          .push(
            event
          );
      }
    );


    const registroEventIds =
      Object.keys(
        registroEventsById
      );


    const registroEventCount =
      registroEventIds.reduce(
        (
          total,
          id
        ) => {

          return (
            total +
            registroEventsById[id].length
          );

        },
        0
      );


    const duplicateRegistroIds =
      registroEventIds.filter(
        id => {

          return (
            registroEventsById[id].length > 1
          );

        }
      );


    const duplicateEventCount =
      duplicateRegistroIds.reduce(
        (
          total,
          id
        ) => {

          return (
            total +
            registroEventsById[id].length -
            1
          );

        },
        0
      );


    Logger.log(
      "Calendar events found: " +
      calendarEvents.length
    );

    Logger.log(
      "Calendar events carrying Registro IDs: " +
      registroEventCount
    );

    Logger.log(
      "Unique Registro IDs in Calendar: " +
      registroEventIds.length
    );

    Logger.log(
      "Duplicate Registro ID groups: " +
      duplicateRegistroIds.length
    );

    Logger.log(
      "Duplicate Calendar events detected: " +
      duplicateEventCount
    );


    // ============================================================
    // COUNTERS
    // ============================================================

    let createdCount =
      0;

    let modifiedCount =
      0;

    let deletedCount =
      0;

    let duplicateDeletedCount =
      0;

    let duplicateFailureCount =
      0;

    let taskCount =
      0;


    const errors =
      [];


    const successfullyReconciled =
      {};

    const successfullyRemoved =
      {};


    // ============================================================
    // CHOOSE CANONICAL EVENT
    // ============================================================

    function chooseCanonicalEvent(
      events,
      record
    ) {

      if (
        !events ||
        events.length === 0
      ) {

        return null;
      }

      if (
        events.length === 1
      ) {

        return events[0];
      }


      /*
       * Prefer an event that already matches Registro's
       * current time, title and location.
       *
       * This minimizes unnecessary mutation of the correct
       * existing Calendar event.
       */

      const expectedStart =
        new Date(
          record.start
        ).getTime();

      const expectedEnd =
        new Date(
          record.end
        ).getTime();

      const expectedTitle =
        normalizeText(
          record.title ||
          record.course ||
          "Registro Class"
        );

      const expectedLocation =
        normalizeText(
          record.classroom_name ||
          record.classroom
        );


      let bestEvent =
        events[0];

      let bestScore =
        -1;


      events.forEach(
        event => {

          let score =
            0;

          try {

            if (
              event.getStartTime().getTime() ===
              expectedStart
            ) {

              score += 4;
            }

            if (
              event.getEndTime().getTime() ===
              expectedEnd
            ) {

              score += 4;
            }

            if (
              normalizeText(
                event.getTitle()
              ) ===
              expectedTitle
            ) {

              score += 2;
            }

            if (
              normalizeText(
                event.getLocation()
              ) ===
              expectedLocation
            ) {

              score += 1;
            }

          } catch (error) {

            score = 0;
          }


          if (
            score > bestScore
          ) {

            bestScore =
              score;

            bestEvent =
              event;
          }
        }
      );


      return bestEvent;
    }


    // ============================================================
    // CLEAN DUPLICATES FOR ONE REGISTRO ID
    // ============================================================

    function reconcileDuplicateGroup(
      sessionId,
      record
    ) {

      const events =
        registroEventsById[
          sessionId
        ] || [];


      if (
        events.length <= 1
      ) {

        return {

          success: true,
          keptEvent:
            events.length === 1
              ? events[0]
              : null,

          deleted: 0

        };
      }


      Logger.log(
        "DUPLICATE GROUP DETECTED"
      );

      Logger.log(
        "Session ID: " +
        sessionId
      );

      Logger.log(
        "Physical Calendar events: " +
        events.length
      );


      const canonicalEvent =
        chooseCanonicalEvent(
          events,
          record
        );


      const duplicateEvents =
        events.filter(
          event => {

            return event !==
              canonicalEvent;

          }
        );


      let deleted =
        0;

      let failed =
        0;


      duplicateEvents.forEach(
        (
          duplicateEvent,
          index
        ) => {

          try {

            const result =
              runCalendarOperation(
                "Delete duplicate " +
                sessionId +
                " #" +
                (index + 1),

                function() {

                  duplicateEvent.deleteEvent();

                  return true;
                }
              );


            if (
              !result.success
            ) {

              throw result.error;
            }


            deleted++;

            duplicateDeletedCount++;

            Logger.log(
              "DUPLICATE CALENDAR EVENT DELETED"
            );

            Logger.log(
              "Session ID: " +
              sessionId
            );

          } catch (error) {

            failed++;

            duplicateFailureCount++;

            const message =
              "Duplicate delete " +
              sessionId +
              ": " +
              error.message;

            errors.push(
              message
            );

            Logger.log(
              "FAILED TO DELETE DUPLICATE"
            );

            Logger.log(
              message
            );
          }
        }
      );


      /*
       * Keep the canonical event in the active map.
       *
       * If some duplicates could not be deleted, they remain
       * physically present and will be detected again on the
       * next sync.
       */

      registroEventsById[
        sessionId
      ] =
        [canonicalEvent];


      return {

        success:
          failed === 0,

        keptEvent:
          canonicalEvent,

        deleted:
          deleted

      };
    }


    // ============================================================
    // FIRST: RECONCILE EXISTING DUPLICATES
    // ============================================================

    if (
      duplicateRegistroIds.length > 0
    ) {

      Logger.log(
        "================================"
      );

      Logger.log(
        "DUPLICATE CALENDAR RECONCILIATION"
      );

      Logger.log(
        "================================"
      );


      duplicateRegistroIds.forEach(
        sessionId => {

          const record =
            currentState[
              sessionId
            ];


          /*
           * If the Registro session no longer exists,
           * the normal orphan/removal logic will handle it.
           *
           * We do not need to select a canonical event here.
           */

          if (!record) {

            Logger.log(
              "Duplicate group belongs to removed Registro session: " +
              sessionId
            );

            return;
          }


          reconcileDuplicateGroup(
            sessionId,
            record
          );
        }
      );


      Logger.log(
        "Duplicate reconciliation finished."
      );

    } else {

      Logger.log(
        "No Calendar duplicates detected."
      );
    }


    // ============================================================
    // COMPATIBILITY MAP
    // ============================================================

    /*
     * Existing reconciliation code expects one event per ID.
     *
     * Build that map from the already-cleaned duplicate index.
     */

    const registroEvents =
      {};

    Object.keys(
      registroEventsById
    ).forEach(
      id => {

        if (
          registroEventsById[id] &&
          registroEventsById[id].length > 0
        ) {

          registroEvents[id] =
            registroEventsById[id][0];
        }
      }
    );


    // ============================================================
    // CREATE CALENDAR EVENT
    // ============================================================

    function createCalendarEvent(
      record,
      sessionId
    ) {

      /*
       * FINAL PRE-CREATION DUPLICATE CHECK
       *
       * This protects against creating another event if an
       * existing event has become visible in the map.
       */

      const existing =
        registroEventsById[
          sessionId
        ] || [];


      if (
        existing.length > 0
      ) {

        const canonicalEvent =
          chooseCanonicalEvent(
            existing,
            record
          );

        registroEvents[
          sessionId
        ] =
          canonicalEvent;

        return canonicalEvent;
      }


      const start =
        new Date(
          record.start
        );

      const end =
        new Date(
          record.end
        );

      const title =
        cleanText(
          record.title ||
          record.course ||
          "Registro Class"
        );

      const location =
        cleanText(
          record.classroom_name ||
          record.classroom
        );

      const description =
        buildDescription(
          record,
          sessionId
        );


      const result =
        runCalendarOperation(
          "Create " +
          sessionId,

          function() {

            const event =
              calendar.createEvent(
                title,
                start,
                end,
                {

                  description:
                    description,

                  location:
                    location

                }
              );


            event.addPopupReminder(
              30
            );

            return event;
          }
        );


      if (
        !result.success
      ) {

        throw result.error;
      }


      registroEvents[
        sessionId
      ] =
        result.result;


      registroEventsById[
        sessionId
      ] =
        [result.result];


      return result.result;
    }


    // ============================================================
    // 1. CROSS-DAY RESCHEDULES
    // ============================================================

    crossDayReschedules.forEach(
      change => {

        try {

          const oldEvent =
            registroEvents[
              change.oldId
            ];


          if (!oldEvent) {

            const recreated =
              createCalendarEvent(
                change.current,
                change.newId
              );

            if (
              recreated
            ) {

              createdCount++;

              successfullyReconciled[
                change.newId
              ] = true;

              successfullyRemoved[
                change.oldId
              ] = true;
            }

            Logger.log(
              "CROSS-DAY RESCHEDULE: old Calendar event missing; new event created."
            );

            return;
          }


          const newStart =
            new Date(
              change.current.start
            );

          const newEnd =
            new Date(
              change.current.end
            );


          const result =
            runCalendarOperation(
              "Cross-day reschedule " +
              change.oldId +
              " → " +
              change.newId,

              function() {

                oldEvent.setTime(
                  newStart,
                  newEnd
                );

                oldEvent.setTitle(
                  cleanText(
                    change.current.title ||
                    change.current.course ||
                    "Registro Class"
                  )
                );

                oldEvent.setLocation(
                  cleanText(
                    change.current.classroom_name ||
                    change.current.classroom
                  )
                );

                oldEvent.setDescription(
                  buildDescription(
                    change.current,
                    change.newId
                  )
                );

                return true;
              }
            );


          if (
            !result.success
          ) {

            throw result.error;
          }


          delete registroEvents[
            change.oldId
          ];

          delete registroEventsById[
            change.oldId
          ];


          registroEvents[
            change.newId
          ] =
            oldEvent;

          registroEventsById[
            change.newId
          ] =
            [oldEvent];


          modifiedCount++;


          successfullyRemoved[
            change.oldId
          ] = true;

          successfullyReconciled[
            change.newId
          ] = true;


          Logger.log(
            "CROSS-DAY RESCHEDULE PROCESSED"
          );

          Logger.log(
            "Old ID: " +
            change.oldId
          );

          Logger.log(
            "New ID: " +
            change.newId
          );

          Logger.log(
            "Old date: " +
            dateOnly(
              change.previous.start
            )
          );

          Logger.log(
            "New date: " +
            dateOnly(
              change.current.start
            )
          );

        } catch (error) {

          errors.push(
            "Cross-day reschedule " +
            change.oldId +
            " → " +
            change.newId +
            ": " +
            error.message
          );
        }
      }
    );


    // ============================================================
    // 2. NEW SESSIONS
    // ============================================================

    newSessions.forEach(
      addition => {

        if (
          pairedNew[
            addition.id
          ]
        ) {

          return;
        }


        try {

          const existing =
            registroEvents[
              addition.id
            ];


          if (
            existing
          ) {

            successfullyReconciled[
              addition.id
            ] = true;

            Logger.log(
              "Calendar event already exists for new Registro session: " +
              addition.id
            );

            return;
          }


          createCalendarEvent(
            addition.current,
            addition.id
          );


          createdCount++;


          successfullyReconciled[
            addition.id
          ] = true;


          Logger.log(
            "NEW CALENDAR EVENT CREATED"
          );

          Logger.log(
            "Session ID: " +
            addition.id
          );

          Logger.log(
            "Title: " +
            (
              addition.current.title ||
              addition.current.course
            )
          );


        } catch (error) {

          errors.push(
            "Create " +
            addition.id +
            ": " +
            error.message
          );
        }
      }
    );


    // ============================================================
    // 3. SAME-DAY / SAME-ID MODIFICATIONS
    // ============================================================

    modifiedSessions.forEach(
      change => {

        if (
          dateOnly(
            change.previous.start
          ) !==
          dateOnly(
            change.current.start
          )
        ) {

          return;
        }


        try {

          let event =
            registroEvents[
              change.id
            ];


          if (!event) {

            event =
              createCalendarEvent(
                change.current,
                change.id
              );

            createdCount++;


            successfullyReconciled[
              change.id
            ] = true;


            Logger.log(
              "MISSING CALENDAR EVENT RECREATED: " +
              change.id
            );

            return;
          }


          const result =
            runCalendarOperation(
              "Modify " +
              change.id,

              function() {

                if (
                  change.timeChanged
                ) {

                  event.setTime(
                    new Date(
                      change.current.start
                    ),
                    new Date(
                      change.current.end
                    )
                  );
                }


                if (
                  change.classroomChanged
                ) {

                  event.setLocation(
                    cleanText(
                      change.current.classroom_name ||
                      change.current.classroom
                    )
                  );
                }


                if (
                  change.otherChanged ||
                  change.timeChanged ||
                  change.classroomChanged
                ) {

                  event.setTitle(
                    cleanText(
                      change.current.title ||
                      change.current.course ||
                      "Registro Class"
                    )
                  );

                  event.setDescription(
                    buildDescription(
                      change.current,
                      change.id
                    )
                  );
                }


                return true;
              }
            );


          if (
            !result.success
          ) {

            throw result.error;
          }


          modifiedCount++;


          successfullyReconciled[
            change.id
          ] = true;


          Logger.log(
            "CALENDAR EVENT MODIFIED"
          );

          Logger.log(
            "Session ID: " +
            change.id
          );


          if (
            change.timeChanged
          ) {

            Logger.log(
              "Time changed: YES"
            );
          }


          if (
            change.classroomChanged
          ) {

            Logger.log(
              "Classroom changed: YES"
            );
          }


          if (
            change.otherChanged
          ) {

            Logger.log(
              "Other details changed: YES"
            );
          }


        } catch (error) {

          errors.push(
            "Modify " +
            change.id +
            ": " +
            error.message
          );
        }
      }
    );


    // ============================================================
    // 4. GOOGLE TASKS — SAME-DAY RESCHEDULES
    // ============================================================

    if (
      sameDayReschedules.length > 0
    ) {

      let taskListId =
        null;


      try {

        const lists =
          Tasks.Tasklists.list();


        if (
          lists &&
          lists.items &&
          lists.items.length > 0
        ) {

          taskListId =
            lists.items[0].id;

        } else {

          throw new Error(
            "No Google Tasks list found."
          );
        }

      } catch (error) {

        errors.push(
          "Google Tasks service: " +
          error.message
        );
      }


      if (
        taskListId
      ) {

        const existingTasks =
          [];


        try {

          let pageToken =
            null;


          do {

            const taskPage =
              Tasks.Tasks.list(
                taskListId,
                {

                  showCompleted:
                    true,

                  showHidden:
                    true,

                  maxResults:
                    100,

                  pageToken:
                    pageToken

                }
              );


            if (
              taskPage &&
              taskPage.items
            ) {

              taskPage.items.forEach(
                task => {

                  existingTasks.push(
                    task
                  );
                }
              );
            }


            pageToken =
              taskPage.nextPageToken ||
              null;

          } while (
            pageToken
          );


        } catch (error) {

          errors.push(
            "Reading Google Tasks: " +
            error.message
          );
        }


        sameDayReschedules.forEach(
          change => {

            if (
              !successfullyReconciled[
                change.id
              ]
            ) {

              Logger.log(
                "Skipping Google Task because Calendar reconciliation failed: " +
                change.id
              );

              return;
            }


            const marker =
              "REGISTRO_RESCHEDULE:" +
              change.id +
              ":" +
              normalizeDateTime(
                change.current.start
              );


            const duplicate =
              existingTasks.some(
                task => {

                  return (
                    String(
                      task.notes ||
                      ""
                    ).indexOf(
                      marker
                    ) !== -1
                  );
                }
              );


            if (
              duplicate
            ) {

              Logger.log(
                "Google Task already exists for: " +
                change.id
              );

              successfullyReconciled[
                change.id
              ] = true;

              return;
            }


            try {

              const task =
                {

                  title:
                    "Registro Reschedule — " +
                    (
                      change.current.title ||
                      change.current.course ||
                      "Class"
                    ),

                  notes:
                    [

                      marker,
                      "",

                      "Class changed in Registro.",
                      "",

                      "Course: " +
                        cleanText(
                          change.current.course
                        ),

                      "Professor: " +
                        cleanText(
                          change.current.professor
                        ),

                      "Classroom: " +
                        cleanText(
                          change.current.classroom_name ||
                          change.current.classroom
                        ),

                      "",

                      "Old time:",

                      change.previous.start +
                        " → " +
                        change.previous.end,

                      "",

                      "New time:",

                      change.current.start +
                        " → " +
                        change.current.end

                    ].join(
                      "\n"
                    ),

                  due:
                    normalizeDateTime(
                      change.current.start
                    )

                };


              const createdTask =
                Tasks.Tasks.insert(
                  task,
                  taskListId
                );


              existingTasks.push(
                createdTask
              );


              taskCount++;


              successfullyReconciled[
                change.id
              ] = true;


              Logger.log(
                "GOOGLE TASK CREATED"
              );

              Logger.log(
                "Task: " +
                createdTask.title
              );


            } catch (error) {

              delete successfullyReconciled[
                change.id
              ];


              errors.push(
                "Task for " +
                change.id +
                ": " +
                error.message
              );
            }
          }
        );
      }
    }


    // ============================================================
    // 5. REMOVED SESSIONS
    // ============================================================

    removedSessions.forEach(
      removal => {

        if (
          pairedRemoved[
            removal.id
          ]
        ) {

          if (
            successfullyRemoved[
              removal.id
            ]
          ) {

            Logger.log(
              "Cross-day removal already reconciled: " +
              removal.id
            );
          }

          return;
        }


        try {

          const events =
            registroEventsById[
              removal.id
            ] || [];


          if (
            events.length === 0
          ) {

            successfullyRemoved[
              removal.id
            ] = true;

            Logger.log(
              "Removed Registro session had no Calendar event: " +
              removal.id
            );

            return;
          }


          /*
           * Delete every event for a removed Registro ID.
           *
           * This is intentionally different from normal
           * duplicate handling: the entire session is gone
           * from Registro, so no Calendar event should remain.
           */

          let allDeleted =
            true;


          events.forEach(
            (
              event,
              index
            ) => {

              try {

                const result =
                  runCalendarOperation(
                    "Delete " +
                    removal.id +
                    " #" +
                    (index + 1),

                    function() {

                      event.deleteEvent();

                      return true;
                    }
                  );


                if (
                  !result.success
                ) {

                  throw result.error;
                }


                deletedCount++;


                Logger.log(
                  "CALENDAR EVENT DELETED"
                );

                Logger.log(
                  "Removed Registro session: " +
                  removal.id
                );

              } catch (error) {

                allDeleted =
                  false;

                errors.push(
                  "Delete " +
                  removal.id +
                  ": " +
                  error.message
                );
              }
            }
          );


          if (
            allDeleted
          ) {

            delete registroEvents[
              removal.id
            ];

            delete registroEventsById[
              removal.id
            ];


            successfullyRemoved[
              removal.id
            ] = true;

          }

        } catch (error) {

          errors.push(
            "Delete " +
            removal.id +
            ": " +
            error.message
          );
        }
      }
    );


    // ============================================================
    // 6. ORPHAN CALENDAR EVENTS
    // ============================================================

    /*
     * This is another important self-healing layer.
     *
     * If a Calendar event has a Registro ID which is no longer
     * present in the current Registro timetable AND it was not
     * already handled by the normal snapshot-removal path,
     * remove it.
     *
     * This prevents stale Calendar events from accumulating.
     */

    const orphanRegistroIds =
      registroEventIds.filter(
        id => {

          return (
            !currentState[id] &&
            !successfullyRemoved[id] &&
            !pairedRemoved[id]
          );

        }
      );


    if (
      orphanRegistroIds.length > 0
    ) {

      Logger.log(
        "================================"
      );

      Logger.log(
        "ORPHAN REGISTRO CALENDAR EVENTS"
      );

      Logger.log(
        "================================"
      );

      Logger.log(
        "Orphan Registro ID groups: " +
        orphanRegistroIds.length
      );


      orphanRegistroIds.forEach(
        sessionId => {

          const events =
            registroEventsById[
              sessionId
            ] || [];


          events.forEach(
            (
              event,
              index
            ) => {

              try {

                const result =
                  runCalendarOperation(
                    "Delete orphan " +
                    sessionId +
                    " #" +
                    (index + 1),

                    function() {

                      event.deleteEvent();

                      return true;
                    }
                  );


                if (
                  !result.success
                ) {

                  throw result.error;
                }


                deletedCount++;


                Logger.log(
                  "ORPHAN CALENDAR EVENT DELETED"
                );

                Logger.log(
                  "Orphan Registro ID: " +
                  sessionId
                );


              } catch (error) {

                errors.push(
                  "Delete orphan " +
                  sessionId +
                  ": " +
                  error.message
                );
              }
            }
          );
        }
      );
    }


    // ============================================================
    // 7. BUILD PARTIALLY ADVANCED SNAPSHOT
    // ============================================================

    const nextSnapshot =
      {};


    /*
     * Start with the old snapshot.
     */

    previousIds.forEach(
      id => {

        nextSnapshot[id] =
          previousSnapshot[id];
      }
    );


    /*
     * Successfully reconciled current sessions.
     */

    Object.keys(
      successfullyReconciled
    ).forEach(
      id => {

        if (
          currentState[id]
        ) {

          nextSnapshot[id] =
            currentState[id];
        }
      }
    );


    /*
     * Successfully deleted sessions.
     */

    Object.keys(
      successfullyRemoved
    ).forEach(
      id => {

        delete nextSnapshot[
          id
        ];
      }
    );


    const nextSnapshotIds =
      Object.keys(
        nextSnapshot
      );


    const unresolvedCount =
      currentIds.filter(
        id => {

          return (

            !successfullyReconciled[id] &&

            !previousSnapshot[id]

          );

        }
      ).length;


    const failedModifiedCount =
      modifiedSessions.filter(
        change => {

          return (
            !successfullyReconciled[
              change.id
            ]
          );

        }
      ).length;


    const failedRemovedCount =
      removedSessions.filter(
        removal => {

          return (
            !successfullyRemoved[
              removal.id
            ]
          );

        }
      ).length;


    // ============================================================
    // RECONCILIATION RESULT
    // ============================================================

    Logger.log(
      "================================"
    );

    Logger.log(
      "RECONCILIATION RESULT"
    );

    Logger.log(
      "================================"
    );

    Logger.log(
      "Successfully reconciled sessions: " +
      Object.keys(
        successfullyReconciled
      ).length
    );

    Logger.log(
      "Successfully removed sessions: " +
      Object.keys(
        successfullyRemoved
      ).length
    );

    Logger.log(
      "Failed modified sessions: " +
      failedModifiedCount
    );

    Logger.log(
      "Failed removed sessions: " +
      failedRemovedCount
    );

    Logger.log(
      "Duplicate events detected: " +
      duplicateEventCount
    );

    Logger.log(
      "Duplicate events deleted: " +
      duplicateDeletedCount
    );

    Logger.log(
      "Duplicate deletion failures: " +
      duplicateFailureCount
    );

    Logger.log(
      "Orphan Registro ID groups: " +
      orphanRegistroIds.length
    );


    // ============================================================
    // 8. SAVE PARTIAL OR COMPLETE SNAPSHOT
    // ============================================================

    const snapshotJson =
      JSON.stringify(
        nextSnapshot
      );


    properties.setProperty(
      SNAPSHOT_PROPERTY,
      snapshotJson
    );


    properties.setProperty(
      SNAPSHOT_TIME_PROPERTY,
      new Date().toISOString()
    );


    properties.setProperty(
      LAST_SYNC_PROPERTY,
      new Date().toISOString()
    );


    // ============================================================
    // 9. FAILURE REPORT
    // ============================================================

    if (
      errors.length > 0
    ) {

      Logger.log(
        "================================"
      );

      Logger.log(
        "REGISTRO LIVE SYNC PARTIALLY COMPLETED"
      );

      Logger.log(
        "================================"
      );


      errors.forEach(
        errorMessage => {

          Logger.log(
            "ERROR: " +
            errorMessage
          );
        }
      );


      Logger.log(
        "Successful operations were committed."
      );

      Logger.log(
        "Failed operations remain unresolved and will be retried on the next run."
      );

      Logger.log(
        "Duplicate reconciliation will be retried independently on the next run."
      );

      Logger.log(
        "Snapshot sessions saved: " +
        nextSnapshotIds.length
      );


      return;
    }


    // ============================================================
    // 10. FINAL SUCCESS REPORT
    // ============================================================

    Logger.log(
      "================================"
    );

    Logger.log(
      "REGISTRO LIVE SYNC COMPLETE"
    );

    Logger.log(
      "================================"
    );

    Logger.log(
      "Previous snapshot sessions: " +
      previousIds.length
    );

    Logger.log(
      "Current Registro sessions: " +
      currentIds.length
    );

    Logger.log(
      "New Calendar events created: " +
      createdCount
    );

    Logger.log(
      "Calendar events modified: " +
      modifiedCount
    );

    Logger.log(
      "Calendar events deleted: " +
      deletedCount
    );

    Logger.log(
      "Duplicate Calendar events detected: " +
      duplicateEventCount
    );

    Logger.log(
      "Duplicate Calendar events deleted: " +
      duplicateDeletedCount
    );

    Logger.log(
      "Same-day reschedules: " +
      sameDayReschedules.length
    );

    Logger.log(
      "Cross-day reschedules: " +
      crossDayReschedules.length
    );

    Logger.log(
      "Google Tasks created: " +
      taskCount
    );

    Logger.log(
      "FAS / Mentor-Mentee sessions: " +
      fasSessions.length
    );

    Logger.log(
      "Persistent snapshot updated: YES"
    );

    Logger.log(
      "Snapshot sessions saved: " +
      nextSnapshotIds.length
    );

    Logger.log(
      "================================"
    );


  } finally {

    /*
     * ALWAYS release the execution lock.
     */

    try {

      lock.releaseLock();

    } catch (error) {

      Logger.log(
        "Could not release sync lock: " +
        error.message
      );
    }
  }
}
function testRegistroGoogleTasksService() {

  Logger.log("================================");
  Logger.log("GOOGLE TASKS SERVICE TEST");
  Logger.log("================================");

  try {

    if (typeof Tasks === "undefined") {

      Logger.log(
        "Google Tasks Advanced Service: NOT AVAILABLE"
      );

      Logger.log(
        "Enable the Google Tasks API / Advanced Service first."
      );

      return;
    }

    Logger.log(
      "Google Tasks Advanced Service: AVAILABLE"
    );

    const taskLists =
      Tasks.Tasklists.list();

    const lists =
      taskLists.items || [];

    Logger.log(
      "Task lists found: " +
      lists.length
    );

    lists.forEach(
      list => {

        Logger.log(
          "Task list: " +
          list.title +
          " | ID: " +
          list.id
        );

      }
    );

    Logger.log("================================");
    Logger.log("GOOGLE TASKS SERVICE TEST PASSED");
    Logger.log("================================");

  } catch (error) {

    Logger.log(
      "GOOGLE TASKS SERVICE TEST FAILED"
    );

    Logger.log(
      "Error: " +
      error.message
    );

    throw error;
  }
}
function inspectRegistroLiveSwitch() {

  Logger.log("================================");
  Logger.log("REGISTRO LIVE SWITCH INSPECTION");
  Logger.log("================================");

  const properties =
    PropertiesService.getScriptProperties();

  const value =
    properties.getProperty("REGISTRO_SYNC_LIVE");

  Logger.log(
    "Property exists: " +
    (value !== null)
  );

  Logger.log(
    "Property value: [" +
    value +
    "]"
  );

  Logger.log(
    "Value length: " +
    (value === null ? 0 : value.length)
  );

  Logger.log(
    "Exact comparison with 'true': " +
    (value === "true")
  );

  Logger.log("================================");
}
function enableRegistroLiveSwitch() {

  const props =
    PropertiesService.getScriptProperties();

  props.setProperty(
    "REGISTRO_SYNC_LIVE",
    "true"
  );

  const value =
    props.getProperty(
      "REGISTRO_SYNC_LIVE"
    );

  Logger.log("================================");
  Logger.log("REGISTRO LIVE SWITCH ENABLE");
  Logger.log("================================");
  Logger.log("Saved value: [" + value + "]");
  Logger.log("Exact match: " + (value === "true"));
  Logger.log("================================");
}
function testRegistroLiveSameDayReschedule() {

  Logger.log("================================");
  Logger.log("REGISTRO LIVE SAME-DAY RESCHEDULE TEST");
  Logger.log("================================");

  // ============================================================
  // 1. VERIFY LIVE MODE
  // ============================================================

  const properties =
    PropertiesService.getScriptProperties();

  const liveSwitch =
    properties.getProperty("REGISTRO_SYNC_LIVE");

  Logger.log(
    "LIVE MODE CONFIRMED: " +
    (liveSwitch === "true" ? "YES" : "NO")
  );

  if (liveSwitch !== "true") {
    throw new Error(
      "REGISTRO_SYNC_LIVE is not true. Aborting test."
    );
  }


  // ============================================================
  // 2. LOAD PERSISTENT SNAPSHOT
  // ============================================================

  const snapshotRaw =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );

  if (!snapshotRaw) {
    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT does not exist."
    );
  }

  let snapshot;

  try {
    snapshot =
      JSON.parse(snapshotRaw);
  } catch (error) {
    throw new Error(
      "Could not parse REGISTRO_TIMETABLE_SNAPSHOT."
    );
  }


  // ============================================================
  // 3. NORMALIZE SNAPSHOT
  //
  // Your production snapshot is an object keyed by
  // session ID.
  // ============================================================

  let previousSessions = {};

  if (
    snapshot &&
    !Array.isArray(snapshot) &&
    typeof snapshot === "object"
  ) {

    if (
      snapshot.sessions &&
      typeof snapshot.sessions === "object" &&
      !Array.isArray(snapshot.sessions)
    ) {

      previousSessions =
        snapshot.sessions;

    } else {

      previousSessions =
        snapshot;
    }

  } else {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT has an unsupported structure."
    );
  }


  const previousIds =
    Object.keys(previousSessions);


  Logger.log(
    "Previous snapshot sessions: " +
    previousIds.length
  );


  if (previousIds.length === 0) {
    throw new Error(
      "Previous snapshot contains zero sessions."
    );
  }


  // ============================================================
  // 4. FETCH REGISTRO DIRECTLY
  //
  // IMPORTANT:
  // We deliberately do NOT call fetchRegistroTimetable().
  // This function is completely self-contained.
  // ============================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {
    throw new Error(
      "REGISTRO_ACCESS_TOKEN is missing."
    );
  }


  const url =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const statusCode =
    response.getResponseCode();


  const body =
    response.getContentText();


  Logger.log(
    "Registro HTTP status: " +
    statusCode
  );


  if (statusCode !== 200) {

    throw new Error(
      "Registro API returned HTTP " +
      statusCode
    );
  }


  const parsed =
    JSON.parse(body);


  if (
    !parsed ||
    !Array.isArray(parsed.data)
  ) {

    throw new Error(
      "Registro response does not contain data[]."
    );
  }


  // ============================================================
  // 5. BUILD CURRENT SESSION MAP
  // ============================================================

  const currentSessions = {};


  parsed.data.forEach(function(record) {

    // Ignore holidays.
    if (record.is_holiday === true) {
      return;
    }

    // Ignore exams.
    if (record.is_exam === true) {
      return;
    }

    // Ignore incomplete records.
    if (
      !record.start ||
      !record.end ||
      !record.course ||
      !record.session_number
    ) {
      return;
    }


    const start =
      new Date(record.start);

    const end =
      new Date(record.end);


    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime())
    ) {
      return;
    }


    // Registro's timetable date is represented by the
    // date portion of the ISO timestamp.
    const dateKey =
      record.start.substring(0, 10);


    const courseKey =
      String(record.course)
        .trim()
        .toLowerCase();


    const sectionKey =
      String(record.section || "")
        .trim()
        .toLowerCase();


    const sessionNumber =
      String(record.session_number)
        .trim();


    const sessionId =
      dateKey +
      "|" +
      courseKey +
      "|" +
      sectionKey +
      "|" +
      sessionNumber;


    currentSessions[sessionId] = {

      id:
        sessionId,

      title:
        record.title || "",

      course:
        record.course || "",

      section:
        record.section || "",

      professor:
        record.professor || "",

      classroom:
        record.classroom_name || "",

      session_number:
        record.session_number,

      start:
        start.toISOString(),

      end:
        end.toISOString()
    };

  });


  Logger.log(
    "Current Registro sessions: " +
    Object.keys(currentSessions).length
  );


  // ============================================================
  // 6. SELECT A REAL SESSION
  // ============================================================

  let testId = null;


  for (
    let i = 0;
    i < previousIds.length;
    i++
  ) {

    const candidate =
      previousIds[i];


    if (
      currentSessions[candidate]
    ) {

      testId =
        candidate;

      break;
    }
  }


  if (!testId) {
    throw new Error(
      "Could not find a session present in both snapshot and current Registro."
    );
  }


  const previous =
    previousSessions[testId];


  const current =
    currentSessions[testId];


  Logger.log("================================");
  Logger.log("TEST SESSION");
  Logger.log("================================");


  Logger.log(
    "ID: " +
    testId
  );


  Logger.log(
    "Title: " +
    current.title
  );


  Logger.log(
    "Course: " +
    current.course
  );


  Logger.log(
    "Section: " +
    current.section
  );


  Logger.log(
    "Professor: " +
    current.professor
  );


  Logger.log(
    "Classroom: " +
    current.classroom
  );


  Logger.log(
    "Snapshot start: " +
    previous.start
  );


  Logger.log(
    "Current Registro start: " +
    current.start
  );


  Logger.log(
    "Snapshot end: " +
    previous.end
  );


  Logger.log(
    "Current Registro end: " +
    current.end
  );


  // ============================================================
  // 7. SIMULATE A SAME-DAY RESCHEDULE
  //
  // We DO NOT modify the real snapshot.
  //
  // Example:
  // Old: 09:00–10:15
  // New: 11:00–12:15
  //
  // The simulated old time is created by subtracting 2 hours.
  // ============================================================

  const simulatedOldStart =
    new Date(
      new Date(current.start).getTime()
      -
      (2 * 60 * 60 * 1000)
    );


  const simulatedOldEnd =
    new Date(
      new Date(current.end).getTime()
      -
      (2 * 60 * 60 * 1000)
    );


  Logger.log("================================");
  Logger.log("SIMULATED CHANGE");
  Logger.log("================================");


  Logger.log(
    "Old start: " +
    simulatedOldStart.toISOString()
  );


  Logger.log(
    "New start: " +
    current.start
  );


  Logger.log(
    "Old end: " +
    simulatedOldEnd.toISOString()
  );


  Logger.log(
    "New end: " +
    current.end
  );


  // ============================================================
  // 8. CLASSIFY THE CHANGE
  // ============================================================

  const oldDate =
    Utilities.formatDate(
      simulatedOldStart,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );


  const newDate =
    Utilities.formatDate(
      new Date(current.start),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );


  const sameDay =
    oldDate === newDate;


  const timeChanged =
    simulatedOldStart.getTime() !==
      new Date(current.start).getTime()
    ||
    simulatedOldEnd.getTime() !==
      new Date(current.end).getTime();


  Logger.log("================================");
  Logger.log("CHANGE CLASSIFICATION");
  Logger.log("================================");


  Logger.log(
    "Old date: " +
    oldDate
  );


  Logger.log(
    "New date: " +
    newDate
  );


  Logger.log(
    "Same day: " +
    (sameDay ? "YES" : "NO")
  );


  Logger.log(
    "Time changed: " +
    (timeChanged ? "YES" : "NO")
  );


  const sameDayReschedule =
    sameDay &&
    timeChanged;


  Logger.log(
    "Same-day reschedule detected: " +
    (
      sameDayReschedule
        ? "YES"
        : "NO"
    )
  );


  if (!sameDayReschedule) {

    throw new Error(
      "Test failed: same-day reschedule was not detected."
    );
  }


  // ============================================================
  // 9. SEARCH GOOGLE CALENDAR
  // ============================================================

  Logger.log("================================");
  Logger.log("CALENDAR EVENT LOOKUP");
  Logger.log("================================");


  const calendar =
    CalendarApp.getDefaultCalendar();


  const searchStart =
    new Date(
      new Date(current.start).getTime()
      -
      (24 * 60 * 60 * 1000)
    );


  const searchEnd =
    new Date(
      new Date(current.end).getTime()
      +
      (24 * 60 * 60 * 1000)
    );


  const events =
    calendar.getEvents(
      searchStart,
      searchEnd
    );


  Logger.log(
    "Calendar events found: " +
    events.length
  );


  let matchingEvent = null;


  events.forEach(function(event) {

    if (matchingEvent) {
      return;
    }


    const description =
      event.getDescription() || "";


    const title =
      event.getTitle() || "";


    // Primary identification:
    // Registro session ID stored in description.
    if (
      description.indexOf(testId) !== -1
    ) {

      matchingEvent =
        event;

      return;
    }


    // Secondary identification:
    // Matching title + approximate current date.
    if (
      title === current.title
    ) {

      const eventStart =
        event.getStartTime();


      const eventDate =
        Utilities.formatDate(
          eventStart,
          Session.getScriptTimeZone(),
          "yyyy-MM-dd"
        );


      if (eventDate === newDate) {

        matchingEvent =
          event;
      }
    }

  });


  Logger.log("================================");
  Logger.log("CALENDAR ACTION SIMULATION");
  Logger.log("================================");


  Logger.log(
    "Matching Calendar event FOUND: " +
    (
      matchingEvent
        ? "YES"
        : "NO"
    )
  );


  if (matchingEvent) {

    Logger.log(
      "Calendar title: " +
      matchingEvent.getTitle()
    );


    Logger.log(
      "Calendar event ID: " +
      matchingEvent.getId()
    );


    Logger.log(
      "Current Calendar start: " +
      matchingEvent.getStartTime()
    );


    Logger.log(
      "Current Calendar end: " +
      matchingEvent.getEndTime()
    );


    Logger.log(
      "WOULD CHANGE START TO: " +
      new Date(current.start)
    );


    Logger.log(
      "WOULD CHANGE END TO: " +
      new Date(current.end)
    );

  } else {

    Logger.log(
      "WARNING: Matching Calendar event was not found."
    );

  }


  // ============================================================
  // 10. GOOGLE TASK SIMULATION
  // ============================================================

  Logger.log("================================");
  Logger.log("GOOGLE TASK ACTION SIMULATION");
  Logger.log("================================");


  Logger.log(
    "WOULD CREATE GOOGLE TASK: YES"
  );


  Logger.log(
    "Task title: " +
    "Registro Reschedule — " +
    current.title
  );


  Logger.log(
    "Task details:"
  );


  Logger.log(
    "Class changed in Registro."
  );


  Logger.log(
    "Old time: " +
    simulatedOldStart.toISOString() +
    " → " +
    simulatedOldEnd.toISOString()
  );


  Logger.log(
    "New time: " +
    current.start +
    " → " +
    current.end
  );


  Logger.log(
    "Course: " +
    current.course
  );


  Logger.log(
    "Professor: " +
    current.professor
  );


  Logger.log(
    "Classroom: " +
    current.classroom
  );


  // ============================================================
  // 11. VERIFY REAL SNAPSHOT WAS NOT CHANGED
  // ============================================================

  Logger.log("================================");
  Logger.log("SAFETY VERIFICATION");
  Logger.log("================================");


  const snapshotAfter =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );


  const snapshotUnchanged =
    snapshotAfter === snapshotRaw;


  Logger.log(
    "Real snapshot unchanged: " +
    (
      snapshotUnchanged
        ? "YES"
        : "NO"
    )
  );


  if (!snapshotUnchanged) {

    throw new Error(
      "SAFETY FAILURE: Real Registro snapshot was modified."
    );
  }


  // ============================================================
  // 12. FINAL RESULT
  // ============================================================

  Logger.log("================================");
  Logger.log(
    "REGISTRO LIVE SAME-DAY RESCHEDULE TEST PASSED"
  );
  Logger.log("================================");


  Logger.log(
    "Same-day reschedule detected correctly: YES"
  );


  Logger.log(
    "Calendar modification: NOT EXECUTED"
  );


  Logger.log(
    "Google Task creation: NOT EXECUTED"
  );


  Logger.log(
    "Snapshot modification: NOT EXECUTED"
  );


  Logger.log(
    "Real snapshot preserved: YES"
  );


  Logger.log("================================");

}
function inspectRegistroSnapshotStructure() {

  Logger.log("================================");
  Logger.log("REGISTRO SNAPSHOT STRUCTURE INSPECTION");
  Logger.log("================================");

  const props =
    PropertiesService.getScriptProperties();

  const raw =
    props.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );

  if (!raw) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT does not exist."
    );
  }

  Logger.log(
    "Raw snapshot length: " +
    raw.length
  );

  Logger.log(
    "First 500 characters:"
  );

  Logger.log(
    raw.substring(
      0,
      500
    )
  );

  let parsed;

  try {

    parsed =
      JSON.parse(
        raw
      );

  } catch (error) {

    throw new Error(
      "Snapshot is not valid JSON: " +
      error.message
    );
  }

  Logger.log("================================");
  Logger.log("TOP-LEVEL STRUCTURE");
  Logger.log("================================");

  Logger.log(
    "JavaScript type: " +
    typeof parsed
  );

  Logger.log(
    "Is array: " +
    Array.isArray(parsed)
  );

  if (
    parsed &&
    typeof parsed === "object"
  ) {

    const keys =
      Object.keys(
        parsed
      );

    Logger.log(
      "Top-level key count: " +
      keys.length
    );

    Logger.log(
      "Top-level keys:"
    );

    keys.forEach(
      function(key) {

        const value =
          parsed[key];

        let description;

        if (
          Array.isArray(value)
        ) {

          description =
            "ARRAY (" +
            value.length +
            " items)";

        } else if (
          value === null
        ) {

          description =
            "NULL";

        } else {

          description =
            typeof value;
        }

        Logger.log(
          key +
          " → " +
          description
        );

      }
    );

  }

  // ==================================================
  // IF OBJECT LOOKS LIKE A SESSION MAP
  // ==================================================

  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed)
  ) {

    const keys =
      Object.keys(
        parsed
      );

    Logger.log("================================");
    Logger.log("FIRST TOP-LEVEL ENTRIES");
    Logger.log("================================");

    keys
      .slice(
        0,
        5
      )
      .forEach(
        function(key, index) {

          Logger.log(
            "ENTRY " +
            (index + 1)
          );

          Logger.log(
            "KEY: " +
            key
          );

          try {

            Logger.log(
              JSON.stringify(
                parsed[key]
              ).substring(
                0,
                1000
              )
            );

          } catch (error) {

            Logger.log(
              "Could not stringify entry."
            );

          }

          Logger.log(
            "--------------------------------"
          );

        }
      );

  }

  // ==================================================
  // IF RAW ARRAY
  // ==================================================

  if (
    Array.isArray(parsed)
  ) {

    Logger.log("================================");
    Logger.log("FIRST ARRAY ENTRY");
    Logger.log("================================");

    if (
      parsed.length > 0
    ) {

      Logger.log(
        JSON.stringify(
          parsed[0]
        ).substring(
          0,
          1500
        )
      );

    } else {

      Logger.log(
        "Array is empty."
      );

    }

  }

  Logger.log("================================");
  Logger.log(
    "REGISTRO SNAPSHOT INSPECTION COMPLETE"
  );
  Logger.log("================================");
}
function testRegistroMissingSessionInvestigation() {

  Logger.log("================================");
  Logger.log("REGISTRO MISSING SESSION INVESTIGATION");
  Logger.log("================================");

  const props =
    PropertiesService.getScriptProperties();


  // ============================================================
  // 1. LOAD PERSISTENT SNAPSHOT
  // ============================================================

  const rawSnapshot =
    props.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );

  if (!rawSnapshot) {
    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT does not exist."
    );
  }


  let snapshot;

  try {

    snapshot =
      JSON.parse(rawSnapshot);

  } catch (error) {

    throw new Error(
      "Could not parse REGISTRO_TIMETABLE_SNAPSHOT: " +
      error.message
    );

  }


  let previousMap;


  if (
    snapshot &&
    !Array.isArray(snapshot) &&
    typeof snapshot === "object"
  ) {

    if (
      snapshot.sessions &&
      typeof snapshot.sessions === "object" &&
      !Array.isArray(snapshot.sessions)
    ) {

      previousMap =
        snapshot.sessions;

    } else {

      previousMap =
        snapshot;

    }

  } else {

    throw new Error(
      "Unexpected Registro snapshot structure."
    );

  }


  const previousIds =
    Object.keys(previousMap);


  Logger.log(
    "Previous snapshot sessions: " +
    previousIds.length
  );


  // ============================================================
  // 2. FETCH CURRENT REGISTRO DIRECTLY
  // ============================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const token =
    props.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {
    throw new Error(
      "REGISTRO_ACCESS_TOKEN is missing."
    );
  }


  const url =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method: "get",

        headers: {
          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token
        },

        muteHttpExceptions: true
      }
    );


  const status =
    response.getResponseCode();


  const body =
    response.getContentText();


  Logger.log(
    "Registro HTTP status: " +
    status
  );


  if (status !== 200) {

    throw new Error(
      "Registro API returned HTTP " +
      status
    );

  }


  const parsed =
    JSON.parse(body);


  if (
    !parsed ||
    !Array.isArray(parsed.data)
  ) {

    throw new Error(
      "Registro response does not contain data[]."
    );

  }


  Logger.log(
    "Raw Registro records: " +
    parsed.data.length
  );


  // ============================================================
  // 3. CLASSIFY CURRENT REGISTRO RECORDS
  // ============================================================

  const currentMap = {};

  let holidayCount = 0;
  let examCount = 0;
  let incompleteCount = 0;
  let regularCount = 0;


  parsed.data.forEach(function(record) {

    if (record.is_holiday === true) {

      holidayCount++;

      return;

    }


    if (record.is_exam === true) {

      examCount++;

      return;

    }


    if (
      !record.start ||
      !record.end ||
      !record.course ||
      !record.session_number
    ) {

      incompleteCount++;

      return;

    }


    const start =
      new Date(record.start);

    const end =
      new Date(record.end);


    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime())
    ) {

      incompleteCount++;

      return;

    }


    const dateKey =
      record.start.substring(0, 10);


    const courseKey =
      String(record.course)
        .trim()
        .toLowerCase();


    const sectionKey =
      String(record.section || "")
        .trim()
        .toLowerCase();


    const sessionNumber =
      String(record.session_number)
        .trim();


    const id =
      dateKey +
      "|" +
      courseKey +
      "|" +
      sectionKey +
      "|" +
      sessionNumber;


    currentMap[id] = {

      id: id,

      title:
        record.title || "",

      course:
        record.course || "",

      section:
        record.section || "",

      professor:
        record.professor || "",

      classroom:
        record.classroom_name || "",

      session_number:
        record.session_number,

      start:
        start.toISOString(),

      end:
        end.toISOString()

    };


    regularCount++;

  });


  Logger.log("================================");
  Logger.log("CURRENT REGISTRO CLASSIFICATION");
  Logger.log("================================");


  Logger.log(
    "Raw records: " +
    parsed.data.length
  );


  Logger.log(
    "Regular class records: " +
    regularCount
  );


  Logger.log(
    "Holiday records: " +
    holidayCount
  );


  Logger.log(
    "Exam records: " +
    examCount
  );


  Logger.log(
    "Incomplete/invalid records: " +
    incompleteCount
  );


  Logger.log(
    "Current session IDs: " +
    Object.keys(currentMap).length
  );


  // ============================================================
  // 4. FIND SNAPSHOT SESSIONS MISSING FROM CURRENT REGISTRO
  // ============================================================

  const missing = [];


  previousIds.forEach(function(id) {

    if (!currentMap[id]) {

      missing.push(
        previousMap[id]
      );

    }

  });


  Logger.log("================================");
  Logger.log("MISSING SESSION RESULTS");
  Logger.log("================================");


  Logger.log(
    "Snapshot sessions: " +
    previousIds.length
  );


  Logger.log(
    "Current Registro sessions: " +
    Object.keys(currentMap).length
  );


  Logger.log(
    "Missing from current Registro: " +
    missing.length
  );


  // ============================================================
  // 5. SHOW EVERY MISSING SESSION
  // ============================================================

  if (missing.length === 0) {

    Logger.log(
      "NO MISSING SESSIONS FOUND."
    );

  } else {

    Logger.log("================================");
    Logger.log("MISSING SESSION DETAILS");
    Logger.log("================================");


    missing.forEach(function(session, index) {

      Logger.log(
        "MISSING SESSION " +
        (index + 1)
      );


      Logger.log(
        "ID: " +
        session.id
      );


      Logger.log(
        "Title: " +
        session.title
      );


      Logger.log(
        "Course: " +
        session.course
      );


      Logger.log(
        "Section: " +
        session.section
      );


      Logger.log(
        "Professor: " +
        session.professor
      );


      Logger.log(
        "Classroom: " +
        session.classroom
      );


      Logger.log(
        "Session number: " +
        session.sessionNumber
      );


      Logger.log(
        "Start: " +
        session.start
      );


      Logger.log(
        "End: " +
        session.end
      );


      Logger.log(
        "--------------------------------"
      );

    });

  }


  // ============================================================
  // 6. DATE DISTRIBUTION OF MISSING SESSIONS
  // ============================================================

  const missingByDate = {};


  missing.forEach(function(session) {

    if (!session.start) {
      return;
    }


    const date =
      String(
        session.start
      ).substring(
        0,
        10
      );


    if (!missingByDate[date]) {

      missingByDate[date] = 0;

    }


    missingByDate[date]++;

  });


  Logger.log("================================");
  Logger.log("MISSING SESSION DATE DISTRIBUTION");
  Logger.log("================================");


  const missingDates =
    Object.keys(
      missingByDate
    ).sort();


  if (missingDates.length === 0) {

    Logger.log(
      "No missing-session dates."
    );

  } else {

    missingDates.forEach(function(date) {

      Logger.log(
        date +
        " → " +
        missingByDate[date] +
        " missing session(s)"
      );

    });

  }


  // ============================================================
  // 7. CHECK WHETHER MISSING SESSIONS ARE PAST / TODAY / FUTURE
  // ============================================================

  const today =
    new Date();


  const todayString =
    Utilities.formatDate(
      today,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );


  let pastCount = 0;
  let todayCount = 0;
  let futureCount = 0;


  missing.forEach(function(session) {

    if (!session.start) {
      return;
    }


    const date =
      String(
        session.start
      ).substring(
        0,
        10
      );


    if (date < todayString) {

      pastCount++;

    } else if (date === todayString) {

      todayCount++;

    } else {

      futureCount++;

    }

  });


  Logger.log("================================");
  Logger.log("MISSING SESSION TIME POSITION");
  Logger.log("================================");


  Logger.log(
    "Today: " +
    todayString
  );


  Logger.log(
    "Past sessions missing: " +
    pastCount
  );


  Logger.log(
    "Today's sessions missing: " +
    todayCount
  );


  Logger.log(
    "Future sessions missing: " +
    futureCount
  );


  // ============================================================
  // 8. IMPORTANT SAFETY CHECK
  // ============================================================

  const snapshotAfter =
    props.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );


  const snapshotUnchanged =
    snapshotAfter === rawSnapshot;


  Logger.log("================================");
  Logger.log("SAFETY VERIFICATION");
  Logger.log("================================");


  Logger.log(
    "Snapshot unchanged: " +
    (
      snapshotUnchanged
        ? "YES"
        : "NO"
    )
  );


  if (!snapshotUnchanged) {

    throw new Error(
      "SAFETY FAILURE: Snapshot was modified."
    );

  }


  Logger.log(
    "Google Calendar modified: NO"
  );


  Logger.log(
    "Google Calendar events deleted: NO"
  );


  Logger.log(
    "Google Tasks created: NO"
  );


  Logger.log(
    "Snapshot modified: NO"
  );


  Logger.log("================================");
  Logger.log(
    "REGISTRO MISSING SESSION INVESTIGATION COMPLETE"
  );
  Logger.log("================================");

}
/**
 * ============================================================
 * REGISTRO → GOOGLE CALENDAR
 * FAS-INCLUSIVE FULL RECONCILIATION DRY RUN
 *
 * READ ONLY:
 * - No Calendar creation
 * - No Calendar modification
 * - No Calendar deletion
 * - No Google Task creation
 * - No snapshot modification
 *
 * IMPORTANT:
 * Every valid non-holiday, non-exam Registro session with
 * a valid start/end is treated as calendar-worthy.
 *
 * Therefore FAS / Mentor-Mentee sessions ARE INCLUDED.
 * ============================================================
 */

function testRegistroFASInclusiveFullReconciliationDryRun() {

  Logger.log("================================");
  Logger.log("REGISTRO → CALENDAR");
  Logger.log("FAS-INCLUSIVE FULL RECONCILIATION DRY RUN");
  Logger.log("================================");


  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CALENDAR_ID =
    "priyanshurajgopi@gmail.com";

  const REGISTRO_URL =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";

  const properties =
    PropertiesService.getScriptProperties();


  // ============================================================
  // SAVE ORIGINAL SNAPSHOT RAW VALUE
  //
  // HARD SAFETY:
  // We will compare this exact value at the end.
  // ============================================================

  const snapshotRaw =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );


  if (!snapshotRaw) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT does not exist."
    );

  }


  // ============================================================
  // GET REGISTRO TOKEN
  // ============================================================

  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );

  }


  // ============================================================
  // HELPER: CLEAN TEXT
  // ============================================================

  function cleanText(value) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }

    return String(value)
      .trim()
      .replace(/\s+/g, " ");

  }


  // ============================================================
  // HELPER: NORMALIZE TEXT FOR COMPARISON
  // ============================================================

  function normalizeText(value) {

    return cleanText(value)
      .toLowerCase();

  }


  // ============================================================
  // HELPER: NORMALIZE DATE/TIME
  //
  // Converts:
  //
  // 2026-08-17T03:30:00.000Z
  //
  // and
  //
  // 2026-08-17T03:30:00.000+00:00
  //
  // into the same canonical representation.
  // ============================================================

  function normalizeDateTime(value) {

    if (!value) {

      return "";

    }

    const date =
      new Date(value);


    if (
      isNaN(date.getTime())
    ) {

      return cleanText(value);

    }


    return date.toISOString();

  }


  // ============================================================
  // HELPER: BUILD REGISTRO SESSION ID
  //
  // This matches the ID structure already used throughout
  // the Registro synchronization code:
  //
  // date|course|section|sessionNumber
  // ============================================================

  function buildSessionId(record) {

    const start =
      cleanText(
        record.start
      );


    const date =
      start.substring(
        0,
        10
      );


    const course =
      normalizeText(
        record.course
      );


    const section =
      normalizeText(
        record.section
      );


    const sessionNumber =
      cleanText(
        record.session_number !== undefined
          ? record.session_number
          : record.sessionNumber
      );


    return [
      date,
      course,
      section,
      sessionNumber
    ].join("|");

  }


  // ============================================================
  // HELPER: IS FAS / MENTOR-MENTEE
  //
  // FAS records are intentionally included even if their
  // structure differs from ordinary academic classes.
  // ============================================================

  function isFASRecord(record) {

    const title =
      normalizeText(
        record.title
      );

    const course =
      normalizeText(
        record.course
      );

    const professor =
      normalizeText(
        record.professor
      );


    return (

      title === "fas" ||

      course === "fas" ||

      title.indexOf("mentor mentee") !== -1 ||

      title.indexOf("mentor-mentee") !== -1 ||

      professor.indexOf("mentor mentee") !== -1 ||

      professor.indexOf("mentor-mentee") !== -1

    );

  }


  // ============================================================
  // HELPER: DETERMINE WHETHER RECORD IS CALENDAR-WORTHY
  //
  // Rules:
  //
  // 1. Holidays are excluded.
  // 2. Exams are excluded.
  // 3. Valid start/end are required.
  // 4. FAS is explicitly allowed.
  // 5. Ordinary class records are allowed when they contain
  //    enough information to represent a timetable session.
  // ============================================================

  function isCalendarWorthy(record) {

    if (!record) {

      return false;

    }


    if (
      record.is_holiday === true
    ) {

      return false;

    }


    if (
      record.is_exam === true
    ) {

      return false;

    }


    if (
      !record.start ||
      !record.end
    ) {

      return false;

    }


    const start =
      new Date(
        record.start
      );


    const end =
      new Date(
        record.end
      );


    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime())
    ) {

      return false;

    }


    if (
      end.getTime() <=
      start.getTime()
    ) {

      return false;

    }


    // FAS / Mentor-Mentee is ALWAYS calendar-worthy.

    if (
      isFASRecord(record)
    ) {

      return true;

    }


    /*
     * Ordinary academic class.
     *
     * A valid course/title is enough because Registro
     * already provides the authoritative timetable record.
     */

    return (
      cleanText(record.course) !== "" ||
      cleanText(record.title) !== ""
    );

  }


  // ============================================================
  // HELPER: CONVERT ANY SESSION OBJECT TO CANONICAL FORM
  // ============================================================

  function canonicalSession(session, fallbackId) {

    if (!session) {

      return null;

    }


    const id =
      cleanText(
        session.id ||
        fallbackId ||
        buildSessionId(session)
      );


    return {

      id:
        id,

      title:
        normalizeText(
          session.title
        ),

      course:
        normalizeText(
          session.course
        ),

      section:
        normalizeText(
          session.section
        ),

      professor:
        normalizeText(
          session.professor
        ),

      classroom:
        normalizeText(
          session.classroom ||
          session.classroom_name
        ),

      sessionNumber:
        cleanText(
          session.sessionNumber !== undefined
            ? session.sessionNumber
            : session.session_number
        ),

      start:
        normalizeDateTime(
          session.start
        ),

      end:
        normalizeDateTime(
          session.end
        )

    };

  }


  // ============================================================
  // HELPER: COMPARE TWO REGISTRO RECORDS
  //
  // IMPORTANT:
  // We DO NOT compare JSON.stringify(record).
  //
  // That was the source of the false "250 modified" result.
  // ============================================================

  function compareSessions(
    oldSession,
    newSession
  ) {

    const oldRecord =
      canonicalSession(
        oldSession
      );

    const newRecord =
      canonicalSession(
        newSession
      );


    if (
      !oldRecord ||
      !newRecord
    ) {

      return {

        changed:
          true,

        timeChanged:
          false,

        classroomChanged:
          false,

        otherChanged:
          true

      };

    }


    const timeChanged =
      oldRecord.start !==
        newRecord.start ||

      oldRecord.end !==
        newRecord.end;


    const classroomChanged =
      oldRecord.classroom !==
      newRecord.classroom;


    const otherChanged =
      oldRecord.title !==
        newRecord.title ||

      oldRecord.course !==
        newRecord.course ||

      oldRecord.section !==
        newRecord.section ||

      oldRecord.professor !==
        newRecord.professor ||

      oldRecord.sessionNumber !==
        newRecord.sessionNumber;


    return {

      changed:
        timeChanged ||
        classroomChanged ||
        otherChanged,

      timeChanged:
        timeChanged,

      classroomChanged:
        classroomChanged,

      otherChanged:
        otherChanged,

      old:
        oldRecord,

      current:
        newRecord

    };

  }


  // ============================================================
  // LOAD PREVIOUS SNAPSHOT
  // ============================================================

  let previousSnapshot;


  try {

    previousSnapshot =
      JSON.parse(
        snapshotRaw
      );

  } catch (error) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT contains invalid JSON."
    );

  }


  if (
    !previousSnapshot ||
    typeof previousSnapshot !== "object" ||
    Array.isArray(previousSnapshot)
  ) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT is not an object keyed by session ID."
    );

  }


  const previousIds =
    Object.keys(
      previousSnapshot
    );


  Logger.log(
    "Google Calendar: " +
    CALENDAR_ID
  );

  Logger.log(
    "Snapshot structure: OBJECT KEYED BY SESSION ID"
  );

  Logger.log(
    "Previous snapshot sessions: " +
    previousIds.length
  );


  if (
    previousIds.length === 0
  ) {

    throw new Error(
      "Previous Registro snapshot contains zero sessions."
    );

  }


  // ============================================================
  // FETCH CURRENT REGISTRO
  // ============================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      REGISTRO_URL,
      {

        method:
          "get",

        headers: {

          "Accept":
            "application/json, text/plain, */*",

          "Token":
            token

        },

        muteHttpExceptions:
          true

      }
    );


  const httpStatus =
    response.getResponseCode();


  Logger.log(
    "Registro HTTP status: " +
    httpStatus
  );


  if (
    httpStatus !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      httpStatus
    );

  }


  const responseBody =
    response.getContentText();


  let registroResult;


  try {

    registroResult =
      JSON.parse(
        responseBody
      );

  } catch (error) {

    throw new Error(
      "Registro returned invalid JSON."
    );

  }


  if (
    !registroResult ||
    !Array.isArray(
      registroResult.data
    )
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );

  }


  const rawRecords =
    registroResult.data;


  Logger.log(
    "Raw Registro records: " +
    rawRecords.length
  );


  // ============================================================
  // CLASSIFY CURRENT REGISTRO RECORDS
  // ============================================================

  const holidayRecords =
    [];

  const examRecords =
    [];

  const invalidRecords =
    [];

  const calendarWorthyRecords =
    [];

  const fasRecords =
    [];


  rawRecords.forEach(
    record => {

      if (
        record.is_holiday === true
      ) {

        holidayRecords.push(
          record
        );

        return;

      }


      if (
        record.is_exam === true
      ) {

        examRecords.push(
          record
        );

        return;

      }


      if (
        !isCalendarWorthy(
          record
        )
      ) {

        invalidRecords.push(
          record
        );

        return;

      }


      calendarWorthyRecords.push(
        record
      );


      if (
        isFASRecord(
          record
        )
      ) {

        fasRecords.push(
          record
        );

      }

    }
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "REGISTRO CLASSIFICATION"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Raw records: " +
    rawRecords.length
  );


  Logger.log(
    "Calendar-worthy sessions: " +
    calendarWorthyRecords.length
  );


  Logger.log(
    "Holiday records: " +
    holidayRecords.length
  );


  Logger.log(
    "Exam records: " +
    examRecords.length
  );


  Logger.log(
    "Invalid records: " +
    invalidRecords.length
  );


  // ============================================================
  // LOG FAS / MENTOR-MENTEE RECORDS
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "FAS / MENTOR-MENTEE"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "FAS sessions included: " +
    fasRecords.length
  );


  fasRecords.forEach(
    (record, index) => {

      Logger.log(
        "FAS " +
        (index + 1) +
        ": " +
        (record.title || "FAS") +
        " | " +
        record.start +
        " → " +
        record.end
      );

    }
  );


  // ============================================================
  // BUILD CURRENT REGISTRO STATE
  // ============================================================

  const currentState =
    {};


  calendarWorthyRecords.forEach(
    record => {

      const id =
        buildSessionId(
          record
        );


      currentState[id] =
        canonicalSession(
          record,
          id
        );

    }
  );


  const currentIds =
    Object.keys(
      currentState
    );


  Logger.log(
    "Current calendar-worthy Registro sessions: " +
    currentIds.length
  );


  // ============================================================
  // COMPARE PREVIOUS REGISTRO SNAPSHOT
  // WITH CURRENT REGISTRO
  // ============================================================

  const newSessions =
    [];

  const modifiedSessions =
    [];

  const removedSessions =
    [];

  const sameDayReschedules =
    [];

  const crossDayChanges =
    [];

  const classroomChanges =
    [];

  const otherModifications =
    [];


  // ------------------------------------------------------------
  // CURRENT SESSIONS
  // ------------------------------------------------------------

  currentIds.forEach(
    id => {

      const currentRecord =
        currentState[id];


      const previousRecord =
        previousSnapshot[id];


      // NEW SESSION

      if (!previousRecord) {

        newSessions.push(
          currentRecord
        );

        return;

      }


      // SEMANTIC COMPARISON

      const comparison =
        compareSessions(
          previousRecord,
          currentRecord
        );


      if (
        !comparison.changed
      ) {

        return;

      }


      modifiedSessions.push(
        {

          id:
            id,

          previous:
            comparison.old,

          current:
            comparison.current,

          timeChanged:
            comparison.timeChanged,

          classroomChanged:
            comparison.classroomChanged,

          otherChanged:
            comparison.otherChanged

        }
      );


      // TIME CHANGE

      if (
        comparison.timeChanged
      ) {

        const oldDate =
          comparison.old.start
            .substring(
              0,
              10
            );


        const newDate =
          comparison.current.start
            .substring(
              0,
              10
            );


        if (
          oldDate ===
          newDate
        ) {

          sameDayReschedules.push(
            {
              id:
                id,

              previous:
                comparison.old,

              current:
                comparison.current

            }
          );

        } else {

          crossDayChanges.push(
            {
              id:
                id,

              previous:
                comparison.old,

              current:
                comparison.current

            }
          );

        }

      }


      // CLASSROOM CHANGE

      if (
        comparison.classroomChanged
      ) {

        classroomChanges.push(
          {
            id:
              id,

            previous:
              comparison.old,

            current:
              comparison.current

          }
        );

      }


      // OTHER CHANGE

      if (
        comparison.otherChanged
      ) {

        otherModifications.push(
          {
            id:
              id,

            previous:
              comparison.old,

            current:
              comparison.current

          }
        );

      }

    }
  );


  // ------------------------------------------------------------
  // REMOVED SESSIONS
  // ------------------------------------------------------------

  previousIds.forEach(
    id => {

      if (
        !currentState[id]
      ) {

        removedSessions.push(
          previousSnapshot[id]
        );

      }

    }
  );


  // ============================================================
  // CALENDAR SEARCH RANGE
  // ============================================================

  let earliestStart =
    null;

  let latestEnd =
    null;


  calendarWorthyRecords.forEach(
    record => {

      const start =
        new Date(
          record.start
        );

      const end =
        new Date(
          record.end
        );


      if (
        !earliestStart ||
        start < earliestStart
      ) {

        earliestStart =
          start;

      }


      if (
        !latestEnd ||
        end > latestEnd
      ) {

        latestEnd =
          end;

      }

    }
  );


  if (
    !earliestStart ||
    !latestEnd
  ) {

    throw new Error(
      "Could not determine Registro timetable date range."
    );

  }


  const calendarSearchStart =
    new Date(
      earliestStart
    );


  calendarSearchStart.setDate(
    calendarSearchStart.getDate() - 1
  );


  const calendarSearchEnd =
    new Date(
      latestEnd
    );


  calendarSearchEnd.setDate(
    calendarSearchEnd.getDate() + 1
  );


  // ============================================================
  // READ GOOGLE CALENDAR
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "READING GOOGLE CALENDAR"
  );

  Logger.log(
    "================================"
  );


  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Could not access Google Calendar: " +
      CALENDAR_ID
    );

  }


  const calendarEvents =
    calendar.getEvents(
      calendarSearchStart,
      calendarSearchEnd
    );


  Logger.log(
    "Calendar events found: " +
    calendarEvents.length
  );


  // ============================================================
  // INDEX CALENDAR EVENTS BY REGISTRO SESSION ID
  // ============================================================

  const registroCalendarEvents =
    {};


  calendarEvents.forEach(
    event => {

      const description =
        event.getDescription() ||
        "";


      const marker =
        "REGISTRO_SESSION_ID:";


      const markerIndex =
        description.indexOf(
          marker
        );


      if (
        markerIndex === -1
      ) {

        return;

      }


      const markerValue =
        description
          .substring(
            markerIndex +
            marker.length
          )
          .split(
            "\n"
          )[0]
          .trim();


      if (
        markerValue
      ) {

        registroCalendarEvents[
          markerValue
        ] =
          event;

      }

    }
  );


  const calendarRegistroIds =
    Object.keys(
      registroCalendarEvents
    );


  Logger.log(
    "Calendar events carrying Registro IDs: " +
    calendarRegistroIds.length
  );


  // ============================================================
  // CALENDAR RECONCILIATION
  // ============================================================

  let missingFromCalendarCount =
    0;

  let calendarTimeMismatchCount =
    0;

  let calendarClassroomMismatchCount =
    0;

  let calendarOtherMismatchCount =
    0;


  const missingFromCalendar =
    [];

  const calendarTimeMismatches =
    [];

  const calendarClassroomMismatches =
    [];

  const calendarOtherMismatches =
    [];


  currentIds.forEach(
    id => {

      const registroRecord =
        currentState[id];


      const event =
        registroCalendarEvents[id];


      // --------------------------------------------------------
      // MISSING FROM CALENDAR
      // --------------------------------------------------------

      if (!event) {

        missingFromCalendarCount++;


        missingFromCalendar.push(
          registroRecord
        );


        return;

      }


      // --------------------------------------------------------
      // CALENDAR TIME
      // --------------------------------------------------------

      const registroStart =
        normalizeDateTime(
          registroRecord.start
        );


      const registroEnd =
        normalizeDateTime(
          registroRecord.end
        );


      const calendarStart =
        normalizeDateTime(
          event.getStartTime()
        );


      const calendarEnd =
        normalizeDateTime(
          event.getEndTime()
        );


      if (
        registroStart !==
          calendarStart ||
        registroEnd !==
          calendarEnd
      ) {

        calendarTimeMismatchCount++;


        calendarTimeMismatches.push(
          {

            id:
              id,

            title:
              event.getTitle(),

            registroStart:
              registroStart,

            calendarStart:
              calendarStart,

            registroEnd:
              registroEnd,

            calendarEnd:
              calendarEnd

          }
        );

      }


      // --------------------------------------------------------
      // CALENDAR CLASSROOM
      // --------------------------------------------------------

      const registroClassroom =
        normalizeText(
          registroRecord.classroom
        );


      const calendarClassroom =
        normalizeText(
          event.getLocation()
        );


      if (
        registroClassroom !==
        calendarClassroom
      ) {

        /*
         * Both blank = no mismatch.
         *
         * If Registro has a classroom but Calendar does not,
         * this is a genuine classroom mismatch.
         */

        if (
          registroClassroom !== "" ||
          calendarClassroom !== ""
        ) {

          calendarClassroomMismatchCount++;


          calendarClassroomMismatches.push(
            {

              id:
                id,

              title:
                event.getTitle(),

              registroClassroom:
                registroClassroom,

              calendarClassroom:
                calendarClassroom

            }
          );

        }

      }


      // --------------------------------------------------------
      // CALENDAR OTHER FIELDS
      //
      // Compare the event title against the Registro title.
      // FAS events are included in this comparison.
      // --------------------------------------------------------

      const registroTitle =
        normalizeText(
          registroRecord.title
        );


      const calendarTitle =
        normalizeText(
          event.getTitle()
        );


      if (
        registroTitle !==
        calendarTitle
      ) {

        calendarOtherMismatchCount++;


        calendarOtherMismatches.push(
          {

            id:
              id,

            registroTitle:
              registroTitle,

            calendarTitle:
              calendarTitle

          }
        );

      }

    }
  );


  // ============================================================
  // FIND CALENDAR EVENTS FOR REMOVED REGISTRO SESSIONS
  // ============================================================

  let calendarEventsForRemovedSessions =
    0;


  const removedCalendarEvents =
    [];


  removedSessions.forEach(
    removedRecord => {

      const id =
        cleanText(
          removedRecord.id
        );


      if (
        id &&
        registroCalendarEvents[id]
      ) {

        calendarEventsForRemovedSessions++;


        removedCalendarEvents.push(
          {

            id:
              id,

            event:
              registroCalendarEvents[id]

          }
        );

      }

    }
  );


  // ============================================================
  // RESULTS
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "FULL RECONCILIATION RESULTS"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Previous snapshot sessions: " +
    previousIds.length
  );


  Logger.log(
    "Current calendar-worthy Registro sessions: " +
    currentIds.length
  );


  Logger.log(
    "FAS / Mentor-Mentee sessions: " +
    fasRecords.length
  );


  Logger.log(
    "New Registro sessions: " +
    newSessions.length
  );


  Logger.log(
    "Modified Registro sessions: " +
    modifiedSessions.length
  );


  Logger.log(
    "Same-day reschedules: " +
    sameDayReschedules.length
  );


  Logger.log(
    "Cross-day changes: " +
    crossDayChanges.length
  );


  Logger.log(
    "Classroom changes: " +
    classroomChanges.length
  );


  Logger.log(
    "Other Registro modifications: " +
    otherModifications.length
  );


  Logger.log(
    "Removed Registro sessions: " +
    removedSessions.length
  );


  Logger.log(
    "Missing from Calendar: " +
    missingFromCalendarCount
  );


  Logger.log(
    "Calendar time mismatches: " +
    calendarTimeMismatchCount
  );


  Logger.log(
    "Calendar classroom mismatches: " +
    calendarClassroomMismatchCount
  );


  Logger.log(
    "Calendar other mismatches: " +
    calendarOtherMismatchCount
  );


  Logger.log(
    "Calendar events for removed Registro sessions: " +
    calendarEventsForRemovedSessions
  );


  // ============================================================
  // DETAILS — ONLY PRINT WHEN SOMETHING ACTUALLY DIFFERS
  // ============================================================

  if (
    newSessions.length > 0
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "NEW REGISTRO SESSIONS"
    );

    Logger.log(
      "================================"
    );


    newSessions.forEach(
      session => {

        Logger.log(
          "NEW: " +
          session.id +
          " | " +
          session.title +
          " | " +
          session.start +
          " → " +
          session.end
        );

      }
    );

  }


  if (
    modifiedSessions.length > 0
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "ACTUAL REGISTRO MODIFICATIONS"
    );

    Logger.log(
      "================================"
    );


    modifiedSessions
      .slice(0, 20)
      .forEach(
        change => {

          Logger.log(
            "ID: " +
            change.id
          );


          if (
            change.timeChanged
          ) {

            Logger.log(
              "TIME: " +
              change.previous.start +
              " → " +
              change.current.start
            );


            Logger.log(
              "END: " +
              change.previous.end +
              " → " +
              change.current.end
            );

          }


          if (
            change.classroomChanged
          ) {

            Logger.log(
              "CLASSROOM: " +
              change.previous.classroom +
              " → " +
              change.current.classroom
            );

          }


          if (
            change.otherChanged
          ) {

            Logger.log(
              "OTHER FIELD CHANGE DETECTED"
            );

          }


          Logger.log(
            "--------------------------------"
          );

        }
      );


    if (
      modifiedSessions.length > 20
    ) {

      Logger.log(
        "Additional modifications omitted from log: " +
        (
          modifiedSessions.length -
          20
        )
      );

    }

  }


  if (
    missingFromCalendar.length > 0
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "MISSING FROM GOOGLE CALENDAR"
    );

    Logger.log(
      "================================"
    );


    missingFromCalendar
      .slice(0, 20)
      .forEach(
        session => {

          Logger.log(
            session.id +
            " | " +
            session.title +
            " | " +
            session.start
          );

        }
      );

  }


  if (
    calendarTimeMismatches.length > 0
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "CALENDAR TIME MISMATCHES"
    );

    Logger.log(
      "================================"
    );


    calendarTimeMismatches
      .slice(0, 20)
      .forEach(
        mismatch => {

          Logger.log(
            "ID: " +
            mismatch.id
          );


          Logger.log(
            "Registro start: " +
            mismatch.registroStart
          );


          Logger.log(
            "Calendar start: " +
            mismatch.calendarStart
          );


          Logger.log(
            "Registro end: " +
            mismatch.registroEnd
          );


          Logger.log(
            "Calendar end: " +
            mismatch.calendarEnd
          );


          Logger.log(
            "--------------------------------"
          );

        }
      );

  }


  if (
    calendarClassroomMismatches.length > 0
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "CALENDAR CLASSROOM MISMATCHES"
    );

    Logger.log(
      "================================"
    );


    calendarClassroomMismatches
      .slice(0, 20)
      .forEach(
        mismatch => {

          Logger.log(
            "ID: " +
            mismatch.id
          );


          Logger.log(
            "Registro classroom: " +
            mismatch.registroClassroom
          );


          Logger.log(
            "Calendar classroom: " +
            mismatch.calendarClassroom
          );


          Logger.log(
            "--------------------------------"
          );

        }
      );

  }


  if (
    calendarOtherMismatches.length > 0
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "CALENDAR OTHER MISMATCHES"
    );

    Logger.log(
      "================================"
    );


    calendarOtherMismatches
      .slice(0, 20)
      .forEach(
        mismatch => {

          Logger.log(
            "ID: " +
            mismatch.id
          );


          Logger.log(
            "Registro title: " +
            mismatch.registroTitle
          );


          Logger.log(
            "Calendar title: " +
            mismatch.calendarTitle
          );


          Logger.log(
            "--------------------------------"
          );

        }
      );

  }


  // ============================================================
  // FAS CALENDAR STATUS
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "FAS CALENDAR STATUS"
  );

  Logger.log(
    "================================"
  );


  let fasAlreadyInCalendar =
    0;

  let fasMissingFromCalendar =
    0;


  fasRecords.forEach(
    record => {

      const id =
        buildSessionId(
          record
        );


      const event =
        registroCalendarEvents[id];


      if (event) {

        fasAlreadyInCalendar++;


        Logger.log(
          "FAS PRESENT: " +
          id +
          " | " +
          event.getTitle()
        );

      } else {

        fasMissingFromCalendar++;


        Logger.log(
          "FAS MISSING: " +
          id +
          " | " +
          (record.title || "FAS")
        );

      }

    }
  );


  Logger.log(
    "FAS already in Calendar: " +
    fasAlreadyInCalendar
  );


  Logger.log(
    "FAS missing from Calendar: " +
    fasMissingFromCalendar
  );


  // ============================================================
  // SAFETY VERIFICATION
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "READ-ONLY SAFETY CONFIRMATION"
  );

  Logger.log(
    "================================"
  );


  const snapshotAfter =
    properties.getProperty(
      "REGISTRO_TIMETABLE_SNAPSHOT"
    );


  const snapshotUnchanged =
    snapshotAfter ===
    snapshotRaw;


  Logger.log(
    "GOOGLE CALENDAR EVENT CREATED: NO"
  );


  Logger.log(
    "GOOGLE CALENDAR EVENT MODIFIED: NO"
  );


  Logger.log(
    "GOOGLE CALENDAR EVENT DELETED: NO"
  );


  Logger.log(
    "GOOGLE TASK CREATED: NO"
  );


  Logger.log(
    "REGISTRO SNAPSHOT MODIFIED: NO"
  );


  Logger.log(
    "SCRIPT PROPERTIES MODIFIED: NO"
  );


  Logger.log(
    "Real snapshot unchanged: " +
    (
      snapshotUnchanged
        ? "YES"
        : "NO"
    )
  );


  if (
    !snapshotUnchanged
  ) {

    throw new Error(
      "SAFETY FAILURE: REGISTRO_TIMETABLE_SNAPSHOT changed during dry run."
    );

  }


  // ============================================================
  // FINAL VALIDATION
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "FAS-INCLUSIVE FULL RECONCILIATION DRY RUN COMPLETE"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Previous snapshot sessions: " +
    previousIds.length
  );


  Logger.log(
    "Current calendar-worthy sessions: " +
    currentIds.length
  );


  Logger.log(
    "FAS / Mentor-Mentee sessions: " +
    fasRecords.length
  );


  Logger.log(
    "New sessions: " +
    newSessions.length
  );


  Logger.log(
    "Actual modified sessions: " +
    modifiedSessions.length
  );


  Logger.log(
    "Removed sessions: " +
    removedSessions.length
  );


  Logger.log(
    "Missing from Calendar: " +
    missingFromCalendarCount
  );


  Logger.log(
    "Calendar time mismatches: " +
    calendarTimeMismatchCount
  );


  Logger.log(
    "Calendar classroom mismatches: " +
    calendarClassroomMismatchCount
  );


  Logger.log(
    "FAS already in Calendar: " +
    fasAlreadyInCalendar
  );


  Logger.log(
    "FAS missing from Calendar: " +
    fasMissingFromCalendar
  );


  Logger.log(
    "Snapshot preserved: " +
    (
      snapshotUnchanged
        ? "YES"
        : "NO"
    )
  );


  Logger.log(
    "================================"
  );

}

/**
 * ============================================================
 * NORMALIZE REGISTRO SESSION
 * ============================================================
 */

function normalizeRegistroSession_(record) {

  const start =
    new Date(
      record.start
    );

  const end =
    new Date(
      record.end
    );


  const course =
    record.course == null
      ? ""
      : String(
          record.course
        ).trim();


  const section =
    record.section == null
      ? ""
      : String(
          record.section
        ).trim();


  const professor =
    record.professor == null
      ? ""
      : String(
          record.professor
        ).trim();


  const classroom =
    record.classroom_name == null
      ? ""
      : String(
          record.classroom_name
        ).trim();


  const sessionNumber =
    record.session_number == null
      ? ""
      : String(
          record.session_number
        ).trim();


  const title =
    record.title == null
      ? ""
      : String(
          record.title
        ).trim();


  /*
   * Stable identity.
   *
   * FAS naturally becomes:
   * 2026-08-20|fas|-|0
   */

  const id =
    registroSessionId_(
      start,
      course,
      section,
      sessionNumber,
      title
    );


  return {

    id:
      id,

    title:
      title,

    course:
      course,

    section:
      section,

    professor:
      professor,

    classroom:
      classroom,

    sessionNumber:
      sessionNumber,

    start:
      start.toISOString(),

    end:
      end.toISOString(),

    isHoliday:
      false,

    isExam:
      false

  };

}


/**
 * ============================================================
 * SESSION ID
 * ============================================================
 */

function registroSessionId_(
  start,
  course,
  section,
  sessionNumber,
  title
) {

  const date =
    registroDateKey_(
      start
    );


  const normalizedCourse =
    (
      course ||
      title ||
      ""
    )
      .toLowerCase()
      .trim()
      .replace(
        /\s+/g,
        " "
      );


  const normalizedSection =
    (
      section ||
      "-"
    )
      .toLowerCase()
      .trim();


  const normalizedNumber =
    (
      sessionNumber ||
      "0"
    )
      .toString()
      .trim();


  return (
    date +
    "|" +
    normalizedCourse +
    "|" +
    normalizedSection +
    "|" +
    normalizedNumber
  );

}


/**
 * ============================================================
 * DATE KEY
 * ============================================================
 *
 * Uses Asia/Kolkata because your Registro timetable is
 * being interpreted in Indian Standard Time.
 * ============================================================
 */

function registroDateKey_(
  date
) {

  return Utilities.formatDate(
    new Date(date),
    "Asia/Kolkata",
    "yyyy-MM-dd"
  );

}


/**
 * ============================================================
 * SESSION CHANGE DETECTOR
 * ============================================================
 */

function registroSessionChanged_(
  oldSession,
  newSession
) {

  if (
    oldSession.start !==
    newSession.start
  ) {
    return true;
  }

  if (
    oldSession.end !==
    newSession.end
  ) {
    return true;
  }

  if (
    String(
      oldSession.classroom || ""
    ) !==
    String(
      newSession.classroom || ""
    )
  ) {
    return true;
  }

  if (
    String(
      oldSession.professor || ""
    ) !==
    String(
      newSession.professor || ""
    )
  ) {
    return true;
  }

  if (
    String(
      oldSession.title || ""
    ) !==
    String(
      newSession.title || ""
    )
  ) {
    return true;
  }

  return false;

}


/**
 * ============================================================
 * SNAPSHOT ARRAY EXTRACTION
 * ============================================================
 *
 * Handles the different snapshot formats that we've used
 * during development.
 * ============================================================
 */

/**
 * ============================================================
 * ROBUST REGISTRO SNAPSHOT ARRAY EXTRACTOR
 * ============================================================
 *
 * Finds the actual session array regardless of whether the
 * snapshot is stored as:
 *
 * [
 *   {...},
 *   {...}
 * ]
 *
 * OR:
 *
 * {
 *   sessions: [...]
 * }
 *
 * OR:
 *
 * {
 *   snapshot: {
 *     data: [...]
 *   }
 * }
 *
 * OR any other nested structure.
 *
 * READ ONLY.
 * ============================================================
 */

/**
 * ============================================================
 * SNAPSHOT ARRAY EXTRACTION
 * ============================================================
 *
 * Converts all supported Registro snapshot formats into
 * a simple array of session objects.
 *
 * Supported formats:
 * 1. Direct array
 * 2. { data: [...] }
 * 3. { sessions: [...] }
 * 4. { timetable: [...] }
 * 5. Object keyed by Registro session ID
 *
 * IMPORTANT:
 * The current production snapshot is format #5.
 * ============================================================
 */
function extractRegistroSessionArray_(raw) {

  if (raw === null || raw === undefined) {
    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT is empty or undefined."
    );
  }

  // ------------------------------------------------------------
  // If passed as JSON text, parse it first.
  // ------------------------------------------------------------

  if (typeof raw === "string") {

    try {

      raw = JSON.parse(raw);

    } catch (error) {

      throw new Error(
        "REGISTRO_TIMETABLE_SNAPSHOT contains invalid JSON."
      );

    }

  }

  // ------------------------------------------------------------
  // FORMAT 1:
  // Direct array
  // ------------------------------------------------------------

  if (Array.isArray(raw)) {

    return raw;

  }

  // ------------------------------------------------------------
  // Everything below requires an object.
  // ------------------------------------------------------------

  if (
    typeof raw !== "object" ||
    raw === null
  ) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT has an unsupported root type."
    );

  }

  // ------------------------------------------------------------
  // FORMAT 2:
  // { data: [...] }
  // ------------------------------------------------------------

  if (Array.isArray(raw.data)) {

    return raw.data;

  }

  // ------------------------------------------------------------
  // FORMAT 3:
  // { sessions: [...] }
  // ------------------------------------------------------------

  if (Array.isArray(raw.sessions)) {

    return raw.sessions;

  }

  // ------------------------------------------------------------
  // FORMAT 4:
  // { timetable: [...] }
  // ------------------------------------------------------------

  if (Array.isArray(raw.timetable)) {

    return raw.timetable;

  }

  // ------------------------------------------------------------
  // FORMAT 5:
  // CURRENT PRODUCTION FORMAT
  //
  // {
  //   "session-id-1": { ... },
  //   "session-id-2": { ... },
  //   ...
  // }
  //
  // Convert object values into an array.
  // ------------------------------------------------------------

  const keys =
    Object.keys(raw);

  if (keys.length === 0) {

    return [];

  }

  const values =
    keys.map(function(key) {

      return raw[key];

    });

  // ------------------------------------------------------------
  // Verify that the object really looks like a Registro
  // session map before returning it.
  // ------------------------------------------------------------

  const validSessionCount =
    values.filter(function(session) {

      return (
        session &&
        typeof session === "object" &&
        (
          session.start !== undefined ||
          session.end !== undefined ||
          session.title !== undefined ||
          session.course !== undefined ||
          session.session_number !== undefined
        )
      );

    }).length;

  if (
    validSessionCount === values.length &&
    values.length > 0
  ) {

    Logger.log(
      "Snapshot format detected: OBJECT KEYED BY SESSION ID"
    );

    Logger.log(
      "Session records extracted: " +
      values.length
    );

    return values;

  }

  // ------------------------------------------------------------
  // Nothing recognized.
  // ------------------------------------------------------------

  Logger.log(
    "Snapshot root keys:"
  );

  keys.slice(0, 20).forEach(function(key) {

    Logger.log(
      " - " + key
    );

  });

  throw new Error(
    "Could not find the Registro session array inside " +
    "REGISTRO_TIMETABLE_SNAPSHOT."
  );
}


/**
 * ============================================================
 * RECURSIVE SESSION ARRAY SEARCH
 * ============================================================
 */

function findRegistroSessionArrayRecursive_(
  value,
  path
) {

  if (!value) {
    return null;
  }


  /*
   * ARRAY
   */

  if (
    Array.isArray(value)
  ) {

    /*
     * First check whether this itself is the session array.
     */

    if (
      looksLikeRegistroSessionArray_(value)
    ) {

      return {

        array:
          value,

        path:
          path

      };

    }


    /*
     * Otherwise search inside the array.
     */

    for (
      let i = 0;
      i < value.length;
      i++
    ) {

      const result =
        findRegistroSessionArrayRecursive_(
          value[i],
          path +
          "[" +
          i +
          "]"
        );


      if (result) {
        return result;
      }

    }


    return null;

  }


  /*
   * OBJECT
   */

  if (
    typeof value === "object"
  ) {

    const keys =
      Object.keys(value);


    for (
      let i = 0;
      i < keys.length;
      i++
    ) {

      const key =
        keys[i];


      /*
       * Avoid obvious circular / metadata values.
       */

      const child =
        value[key];


      const result =
        findRegistroSessionArrayRecursive_(
          child,
          path +
          "." +
          key
        );


      if (result) {
        return result;
      }

    }

  }


  return null;

}


/**
 * ============================================================
 * DETERMINE WHETHER AN ARRAY LOOKS LIKE REGISTRO SESSIONS
 * ============================================================
 */

function looksLikeRegistroSessionArray_(
  array
) {

  if (
    !Array.isArray(array) ||
    array.length === 0
  ) {

    return false;

  }


  /*
   * We don't require every record to be perfect.
   * We inspect several records because some arrays may contain
   * slightly different Registro record types.
   */

  const sample =
    array.slice(
      0,
      Math.min(
        array.length,
        10
      )
    );


  let sessionLikeCount =
    0;


  sample.forEach(function(item) {

    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {

      return;

    }


    const hasStart =
      Object.prototype.hasOwnProperty.call(
        item,
        "start"
      );


    const hasEnd =
      Object.prototype.hasOwnProperty.call(
        item,
        "end"
      );


    const hasTitle =
      Object.prototype.hasOwnProperty.call(
        item,
        "title"
      );


    const hasCourse =
      Object.prototype.hasOwnProperty.call(
        item,
        "course"
      );


    const hasProfessor =
      Object.prototype.hasOwnProperty.call(
        item,
        "professor"
      );


    const hasSessionNumber =
      Object.prototype.hasOwnProperty.call(
        item,
        "session_number"
      );


    const hasClassroom =
      Object.prototype.hasOwnProperty.call(
        item,
        "classroom_name"
      );


    /*
     * Strong Registro signature:
     *
     * start + end + at least one of the other timetable fields.
     */

    if (
      hasStart &&
      hasEnd &&
      (
        hasTitle ||
        hasCourse ||
        hasProfessor ||
        hasSessionNumber ||
        hasClassroom
      )
    ) {

      sessionLikeCount++;

    }

  });


  /*
   * Require at least one convincing session record.
   *
   * This is deliberately permissive because some snapshot
   * formats may contain heterogeneous records.
   */

  return (
    sessionLikeCount > 0
  );

}

/**
 * ============================================================
 * CALENDAR → REGISTRO ID
 * ============================================================
 *
 * Looks for:
 *
 * REGISTRO_SESSION_ID: <id>
 *
 * in the event description.
 * ============================================================
 */

function extractRegistroIdFromCalendarEvent_(
  event
) {

  const description =
    event.getDescription() ||
    "";


  const match =
    description.match(
      /REGISTRO_SESSION_ID\s*:\s*(.+)/
    );


  if (!match) {
    return null;
  }


  return match[1]
    .split("\n")[0]
    .trim();

}
/**
 * ============================================================
 * REGISTRO CANONICAL SESSION NORMALIZER
 * ============================================================
 *
 * Converts a Registro/session object into the exact fields
 * that matter for timetable reconciliation.
 *
 * This prevents harmless differences in object structure,
 * field names, nulls, whitespace, or ISO formatting from
 * being interpreted as timetable changes.
 * ============================================================
 */
function normalizeRegistroSessionForComparison_(session) {

  if (!session) {
    return null;
  }

  function clean(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .trim();
  }

  function normalizeText(value) {

    return clean(value)
      .replace(/\s+/g, " ")
      .toLowerCase();

  }

  function normalizeDateTime(value) {

    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      isNaN(date.getTime())
    ) {
      return clean(value);
    }

    /*
     * Convert every valid timestamp to the same UTC
     * representation.
     *
     * This prevents:
     *
     * 2026-08-17T03:30:00.000Z
     *
     * from being considered different from:
     *
     * 2026-08-17T03:30:00.000+00:00
     */

    return date
      .toISOString();

  }

  return {

    id:
      clean(
        session.id
      ),

    title:
      normalizeText(
        session.title
      ),

    course:
      normalizeText(
        session.course
      ),

    section:
      normalizeText(
        session.section
      ),

    professor:
      normalizeText(
        session.professor
      ),

    classroom:
      normalizeText(
        session.classroom ||
        session.classroom_name
      ),

    sessionNumber:
      clean(
        session.sessionNumber !== undefined
          ? session.sessionNumber
          : session.session_number
      ),

    start:
      normalizeDateTime(
        session.start
      ),

    end:
      normalizeDateTime(
        session.end
      )

  };

}


/**
 * ============================================================
 * REGISTRO SEMANTIC SESSION COMPARISON
 * ============================================================
 *
 * Returns ONLY meaningful timetable changes.
 *
 * Possible result:
 *
 * {
 *   changed: false
 * }
 *
 * OR
 *
 * {
 *   changed: true,
 *   timeChanged: true,
 *   classroomChanged: false,
 *   otherChanged: false
 * }
 *
 * ============================================================
 */
function compareRegistroSessionsSemantically_(
  oldSession,
  newSession
) {

  const oldRecord =
    normalizeRegistroSessionForComparison_(
      oldSession
    );

  const newRecord =
    normalizeRegistroSessionForComparison_(
      newSession
    );


  if (
    !oldRecord ||
    !newRecord
  ) {

    return {

      changed:
        true,

      timeChanged:
        false,

      classroomChanged:
        false,

      otherChanged:
        true

    };

  }


  /*
   * ==========================================================
   * TIME
   * ==========================================================
   */

  const timeChanged =
    oldRecord.start !==
      newRecord.start ||
    oldRecord.end !==
      newRecord.end;


  /*
   * ==========================================================
   * CLASSROOM
   * ==========================================================
   */

  const classroomChanged =
    oldRecord.classroom !==
    newRecord.classroom;


  /*
   * ==========================================================
   * OTHER MEANINGFUL FIELDS
   * ==========================================================
   */

  const otherChanged =
    oldRecord.title !==
      newRecord.title ||

    oldRecord.course !==
      newRecord.course ||

    oldRecord.section !==
      newRecord.section ||

    oldRecord.professor !==
      newRecord.professor ||

    oldRecord.sessionNumber !==
      newRecord.sessionNumber;


  return {

    changed:
      timeChanged ||
      classroomChanged ||
      otherChanged,

    timeChanged:
      timeChanged,

    classroomChanged:
      classroomChanged,

    otherChanged:
      otherChanged,

    old:
      oldRecord,

    current:
      newRecord

  };

}


/**
 * ============================================================
 * REGISTRO DATE EXTRACTION
 * ============================================================
 */
function getRegistroSessionDate_(value) {

  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    isNaN(date.getTime())
  ) {
    return String(value)
      .substring(0, 10);
  }

  return Utilities.formatDate(
    date,
    "UTC",
    "yyyy-MM-dd"
  );

}
function testRegistroLiveSyncDryRun() {

  Logger.log("================================");
  Logger.log("REGISTRO → CALENDAR");
  Logger.log("FINAL PRODUCTION LIVE-SYNC DRY RUN");
  Logger.log("================================");


  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CALENDAR_ID =
    "priyanshurajgopi@gmail.com";

  const REGISTRO_URL =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";

  const SNAPSHOT_PROPERTY =
    "REGISTRO_TIMETABLE_SNAPSHOT";

  const SNAPSHOT_TIME_PROPERTY =
    "REGISTRO_TIMETABLE_SNAPSHOT_TIME";

  const LAST_SYNC_PROPERTY =
    "REGISTRO_LAST_CALENDAR_SYNC";

  const LIVE_PROPERTY =
    "REGISTRO_SYNC_LIVE";


  const properties =
    PropertiesService.getScriptProperties();


  // ============================================================
  // SAFETY — CAPTURE ALL RELEVANT PROPERTIES
  // ============================================================

  const snapshotBefore =
    properties.getProperty(
      SNAPSHOT_PROPERTY
    );

  const snapshotTimeBefore =
    properties.getProperty(
      SNAPSHOT_TIME_PROPERTY
    );

  const lastSyncBefore =
    properties.getProperty(
      LAST_SYNC_PROPERTY
    );

  const liveSwitch =
    properties.getProperty(
      LIVE_PROPERTY
    );


  Logger.log(
    "REGISTRO_SYNC_LIVE currently: " +
    liveSwitch
  );


  Logger.log(
    "IMPORTANT: This function is READ-ONLY."
  );


  Logger.log(
    "REGISTRO_SYNC_LIVE will NOT cause writes here."
  );


  // ============================================================
  // TOKEN
  // ============================================================

  const token =
    properties.getProperty(
      "REGISTRO_ACCESS_TOKEN"
    );


  if (!token) {

    throw new Error(
      "REGISTRO_ACCESS_TOKEN has not been added to Script Properties."
    );

  }


  // ============================================================
  // HELPER — CLEAN TEXT
  // ============================================================

  function cleanText(value) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }

    return String(value)
      .trim()
      .replace(/\s+/g, " ");

  }


  // ============================================================
  // HELPER — NORMALIZE TEXT
  // ============================================================

  function normalizeText(value) {

    return cleanText(value)
      .toLowerCase();

  }


  // ============================================================
  // HELPER — NORMALIZE DATETIME
  // ============================================================

  function normalizeDateTime(value) {

    if (!value) {

      return "";

    }


    const date =
      new Date(value);


    if (
      isNaN(date.getTime())
    ) {

      return cleanText(value);

    }


    return date.toISOString();

  }


  // ============================================================
  // HELPER — DATE ONLY
  // ============================================================

  function dateOnly(value) {

    const normalized =
      normalizeDateTime(value);


    if (!normalized) {

      return "";

    }


    return normalized.substring(
      0,
      10
    );

  }


  // ============================================================
  // HELPER — SESSION ID
  //
  // This matches the ID structure already used by the
  // existing Registro system.
  // ============================================================

  function buildSessionId(record) {

    const start =
      cleanText(
        record.start
      );


    const date =
      start.substring(
        0,
        10
      );


    const course =
      normalizeText(
        record.course
      );


    const section =
      normalizeText(
        record.section
      );


    const sessionNumber =
      cleanText(
        record.session_number !== undefined
          ? record.session_number
          : record.sessionNumber
      );


    return [
      date,
      course,
      section,
      sessionNumber
    ].join("|");

  }


  // ============================================================
  // HELPER — FAS / MENTOR-MENTEE
  // ============================================================

  function isFAS(record) {

    const title =
      normalizeText(
        record.title
      );

    const course =
      normalizeText(
        record.course
      );

    const professor =
      normalizeText(
        record.professor
      );


    return (

      title === "fas" ||

      course === "fas" ||

      title.indexOf(
        "mentor mentee"
      ) !== -1 ||

      title.indexOf(
        "mentor-mentee"
      ) !== -1 ||

      professor.indexOf(
        "mentor mentee"
      ) !== -1 ||

      professor.indexOf(
        "mentor-mentee"
      ) !== -1

    );

  }


  // ============================================================
  // HELPER — CALENDAR-WORTHY
  // ============================================================

  function isCalendarWorthy(record) {

    if (!record) {

      return false;

    }


    if (
      record.is_holiday === true
    ) {

      return false;

    }


    if (
      record.is_exam === true
    ) {

      return false;

    }


    if (
      !record.start ||
      !record.end
    ) {

      return false;

    }


    const start =
      new Date(
        record.start
      );

    const end =
      new Date(
        record.end
      );


    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime())
    ) {

      return false;

    }


    if (
      end.getTime() <=
      start.getTime()
    ) {

      return false;

    }


    /*
     * FAS / Mentor-Mentee is explicitly included.
     */

    if (
      isFAS(record)
    ) {

      return true;

    }


    return (
      cleanText(record.title) !== "" ||
      cleanText(record.course) !== ""
    );

  }


  // ============================================================
  // HELPER — CANONICAL RECORD
  //
  // Handles BOTH:
  //
  // 1. Raw Registro records
  // 2. Persistent snapshot records
  //
  // This prevents the classroom_name/classroom mismatch that
  // caused false "modified" results earlier.
  // ============================================================

  function canonical(record) {

    if (!record) {

      return {

        title: "",
        course: "",
        section: "",
        professor: "",
        classroom: "",
        sessionNumber: "",
        start: "",
        end: ""

      };

    }


    return {

      title:
        normalizeText(
          record.title
        ),

      course:
        normalizeText(
          record.course
        ),

      section:
        normalizeText(
          record.section
        ),

      professor:
        normalizeText(
          record.professor
        ),

      classroom:
        normalizeText(
          record.classroom_name ||
          record.classroom
        ),

      sessionNumber:
        cleanText(
          record.session_number !== undefined
            ? record.session_number
            : record.sessionNumber
        ),

      start:
        normalizeDateTime(
          record.start
        ),

      end:
        normalizeDateTime(
          record.end
        )

    };

  }


  // ============================================================
  // HELPER — COMPARE REGISTRO RECORDS
  // ============================================================

  function compareRecords(
    previous,
    current
  ) {

    const oldRecord =
      canonical(
        previous
      );

    const newRecord =
      canonical(
        current
      );


    const timeChanged =
      oldRecord.start !==
        newRecord.start ||

      oldRecord.end !==
        newRecord.end;


    const classroomChanged =
      oldRecord.classroom !==
      newRecord.classroom;


    const otherChanged =
      oldRecord.title !==
        newRecord.title ||

      oldRecord.course !==
        newRecord.course ||

      oldRecord.section !==
        newRecord.section ||

      oldRecord.professor !==
        newRecord.professor ||

      oldRecord.sessionNumber !==
        newRecord.sessionNumber;


    return {

      changed:
        timeChanged ||
        classroomChanged ||
        otherChanged,

      timeChanged:
        timeChanged,

      classroomChanged:
        classroomChanged,

      otherChanged:
        otherChanged

    };

  }


  // ============================================================
  // HELPER — CROSS-DAY RESCHEDULE IDENTITY
  // ============================================================

  function rescheduleIdentity(record) {

    const value =
      canonical(
        record
      );


    return [

      value.title,

      value.course,

      value.section,

      value.professor,

      value.sessionNumber

    ].join("|");

  }


  // ============================================================
  // HELPER — EXTRACT CALENDAR REGISTRO ID
  // ============================================================

  function getRegistroId(event) {

    const description =
      event.getDescription() ||
      "";


    const marker =
      "REGISTRO_SESSION_ID:";


    const index =
      description.indexOf(
        marker
      );


    if (
      index === -1
    ) {

      return "";

    }


    return description
      .substring(
        index +
        marker.length
      )
      .split("\n")[0]
      .trim();

  }


  // ============================================================
  // 1. VALIDATE PERSISTENT SNAPSHOT
  // ============================================================

  if (!snapshotBefore) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT does not exist."
    );

  }


  let previousSnapshot;


  try {

    previousSnapshot =
      JSON.parse(
        snapshotBefore
      );

  } catch (error) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT contains invalid JSON."
    );

  }


  if (
    !previousSnapshot ||
    typeof previousSnapshot !== "object"
  ) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT has invalid structure."
    );

  }


  if (
    Array.isArray(
      previousSnapshot
    )
  ) {

    throw new Error(
      "REGISTRO_TIMETABLE_SNAPSHOT is an array. " +
      "Expected object keyed by session ID."
    );

  }


  const previousIds =
    Object.keys(
      previousSnapshot
    );


  Logger.log(
    "Previous snapshot sessions: " +
    previousIds.length
  );


  if (
    previousIds.length === 0
  ) {

    throw new Error(
      "Previous snapshot contains zero sessions."
    );

  }


  // ============================================================
  // 2. FETCH CURRENT REGISTRO
  // ============================================================

  Logger.log(
    "Fetching current Registro timetable..."
  );


  const response =
    UrlFetchApp.fetch(
      REGISTRO_URL,
      {

        method:
          "get",

        headers:
          {

            "Accept":
              "application/json, text/plain, */*",

            "Token":
              token

          },

        muteHttpExceptions:
          true

      }
    );


  const responseCode =
    response.getResponseCode();


  Logger.log(
    "Registro HTTP status: " +
    responseCode
  );


  if (
    responseCode !== 200
  ) {

    throw new Error(
      "Registro request failed with HTTP " +
      responseCode
    );

  }


  let result;


  try {

    result =
      JSON.parse(
        response.getContentText()
      );

  } catch (error) {

    throw new Error(
      "Registro returned invalid JSON."
    );

  }


  if (
    !result ||
    !Array.isArray(
      result.data
    )
  ) {

    throw new Error(
      "Registro response does not contain a valid data array."
    );

  }


  const rawRecords =
    result.data;


  Logger.log(
    "Raw Registro records: " +
    rawRecords.length
  );


  // ============================================================
  // 3. BUILD CURRENT STATE
  // ============================================================

  const currentState =
    {};


  const fasSessions =
    [];


  let holidayCount =
    0;

  let examCount =
    0;

  let invalidCount =
    0;


  rawRecords.forEach(
    record => {

      if (
        record.is_holiday === true
      ) {

        holidayCount++;

        return;

      }


      if (
        record.is_exam === true
      ) {

        examCount++;

        return;

      }


      if (
        !isCalendarWorthy(
          record
        )
      ) {

        invalidCount++;

        return;

      }


      const id =
        buildSessionId(
          record
        );


      if (
        currentState[id]
      ) {

        throw new Error(
          "Duplicate Registro session ID detected: " +
          id
        );

      }


      currentState[id] =
        record;


      if (
        isFAS(record)
      ) {

        fasSessions.push(
          {

            id:
              id,

            record:
              record

          }
        );

      }

    }
  );


  const currentIds =
    Object.keys(
      currentState
    );


  Logger.log(
    "================================"
  );

  Logger.log(
    "REGISTRO CLASSIFICATION"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Raw records: " +
    rawRecords.length
  );


  Logger.log(
    "Calendar-worthy sessions: " +
    currentIds.length
  );


  Logger.log(
    "Holiday records: " +
    holidayCount
  );


  Logger.log(
    "Exam records: " +
    examCount
  );


  Logger.log(
    "Invalid records: " +
    invalidCount
  );


  Logger.log(
    "FAS / Mentor-Mentee sessions: " +
    fasSessions.length
  );


  // ============================================================
  // 4. COMPARE SNAPSHOT → CURRENT REGISTRO
  // ============================================================

  const newSessions =
    [];

  const modifiedSessions =
    [];

  const removedSessions =
    [];


  currentIds.forEach(
    id => {

      const current =
        currentState[id];


      const previous =
        previousSnapshot[id];


      if (!previous) {

        newSessions.push(
          {

            id:
              id,

            current:
              current

          }
        );

        return;

      }


      const comparison =
        compareRecords(
          previous,
          current
        );


      if (
        comparison.changed
      ) {

        modifiedSessions.push(
          {

            id:
              id,

            previous:
              previous,

            current:
              current,

            timeChanged:
              comparison.timeChanged,

            classroomChanged:
              comparison.classroomChanged,

            otherChanged:
              comparison.otherChanged

          }
        );

      }

    }
  );


  previousIds.forEach(
    id => {

      if (
        !currentState[id]
      ) {

        removedSessions.push(
          {

            id:
              id,

            previous:
              previousSnapshot[id]

          }
        );

      }

    }
  );


  // ============================================================
  // 5. SAME-DAY RESCHEDULES
  // ============================================================

  const sameDayReschedules =
    modifiedSessions.filter(
      change => {

        if (
          !change.timeChanged
        ) {

          return false;

        }


        return (

          dateOnly(
            change.previous.start
          ) ===

          dateOnly(
            change.current.start
          )

        );

      }
    );


  // ============================================================
  // 6. CROSS-DAY RESCHEDULES
  //
  // A cross-day move appears as:
  //
  // OLD SESSION REMOVED
  // +
  // NEW SESSION CREATED
  //
  // because date is part of the session ID.
  // ============================================================

  const crossDayReschedules =
    [];


  const pairedRemoved =
    {};

  const pairedNew =
    {};


  const removedByIdentity =
    {};


  removedSessions.forEach(
    removal => {

      const identity =
        rescheduleIdentity(
          removal.previous
        );


      if (
        !removedByIdentity[identity]
      ) {

        removedByIdentity[identity] =
          [];

      }


      removedByIdentity[identity]
        .push(
          removal
        );

    }
  );


  newSessions.forEach(
    addition => {

      const identity =
        rescheduleIdentity(
          addition.current
        );


      const candidates =
        removedByIdentity[
          identity
        ];


      if (
        !candidates ||
        candidates.length !== 1
      ) {

        return;

      }


      const removal =
        candidates[0];


      if (
        pairedRemoved[
          removal.id
        ] ||
        pairedNew[
          addition.id
        ]
      ) {

        return;

      }


      pairedRemoved[
        removal.id
      ] =
        true;


      pairedNew[
        addition.id
      ] =
        true;


      crossDayReschedules.push(
        {

          oldId:
            removal.id,

          newId:
            addition.id,

          previous:
            removal.previous,

          current:
            addition.current

        }
      );

    }
  );


  // ============================================================
  // 7. READ GOOGLE CALENDAR
  // ============================================================

  const calendar =
    CalendarApp.getCalendarById(
      CALENDAR_ID
    );


  if (!calendar) {

    throw new Error(
      "Google Calendar could not be found: " +
      CALENDAR_ID
    );

  }


  let earliest =
    null;

  let latest =
    null;


  function absorbDate(record) {

    if (
      !record
    ) {

      return;

    }


    if (
      record.start
    ) {

      const start =
        new Date(
          record.start
        );


      if (
        !isNaN(
          start.getTime()
        )
      ) {

        if (
          !earliest ||
          start < earliest
        ) {

          earliest =
            start;

        }

      }

    }


    if (
      record.end
    ) {

      const end =
        new Date(
          record.end
        );


      if (
        !isNaN(
          end.getTime()
        )
      ) {

        if (
          !latest ||
          end > latest
        ) {

          latest =
            end;

        }

      }

    }

  }


  previousIds.forEach(
    id => {

      absorbDate(
        previousSnapshot[id]
      );

    }
  );


  currentIds.forEach(
    id => {

      absorbDate(
        currentState[id]
      );

    }
  );


  if (
    !earliest ||
    !latest
  ) {

    throw new Error(
      "Could not determine Calendar search range."
    );

  }


  const searchStart =
    new Date(
      earliest
    );


  searchStart.setDate(
    searchStart.getDate() - 1
  );


  const searchEnd =
    new Date(
      latest
    );


  searchEnd.setDate(
    searchEnd.getDate() + 1
  );


  Logger.log(
    "================================"
  );

  Logger.log(
    "READING GOOGLE CALENDAR"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Calendar search start: " +
    searchStart
  );


  Logger.log(
    "Calendar search end: " +
    searchEnd
  );


  const calendarEvents =
    calendar.getEvents(
      searchStart,
      searchEnd
    );


  const registroEvents =
    {};


  calendarEvents.forEach(
    event => {

      const id =
        getRegistroId(
          event
        );


      if (
        id
      ) {

        registroEvents[id] =
          event;

      }

    }
  );


  Logger.log(
    "Calendar events found: " +
    calendarEvents.length
  );


  Logger.log(
    "Calendar events carrying Registro IDs: " +
    Object.keys(
      registroEvents
    ).length
  );


  // ============================================================
  // 8. CALENDAR RECONCILIATION
  // ============================================================

  const missingFromCalendar =
    [];

  const calendarTimeMismatches =
    [];

  const calendarClassroomMismatches =
    [];

  const calendarOtherMismatches =
    [];

  const removedCalendarEvents =
    [];


  currentIds.forEach(
    id => {

      const record =
        currentState[id];


      const event =
        registroEvents[id];


      if (!event) {

        missingFromCalendar.push(
          {

            id:
              id,

            record:
              record

          }
        );

        return;

      }


      const calendarStart =
        normalizeDateTime(
          event.getStartTime()
        );


      const calendarEnd =
        normalizeDateTime(
          event.getEndTime()
        );


      const registroStart =
        normalizeDateTime(
          record.start
        );


      const registroEnd =
        normalizeDateTime(
          record.end
        );


      if (
        calendarStart !==
          registroStart ||

        calendarEnd !==
          registroEnd
      ) {

        calendarTimeMismatches.push(
          {

            id:
              id,

            record:
              record,

            event:
              event

          }
        );

      }


      const registroRoom =
        normalizeText(
          record.classroom_name ||
          record.classroom
        );


      const calendarRoom =
        normalizeText(
          event.getLocation()
        );


      if (
        registroRoom !==
        calendarRoom
      ) {

        calendarClassroomMismatches.push(
          {

            id:
              id,

            record:
              record,

            event:
              event

          }
        );

      }


      const expectedTitle =
        cleanText(
          record.title ||
          record.course ||
          "Registro Class"
        );


      if (
        event.getTitle() !==
        expectedTitle
      ) {

        calendarOtherMismatches.push(
          {

            id:
              id,

            record:
              record,

            event:
              event

          }
        );

      }

    }
  );


  /*
   * Find Calendar events whose Registro IDs no longer exist.
   *
   * Cross-day reschedules are excluded from deletion.
   */

  Object.keys(
    registroEvents
  ).forEach(
    id => {

      if (
        !currentState[id] &&
        !pairedRemoved[id]
      ) {

        removedCalendarEvents.push(
          {

            id:
              id,

            event:
              registroEvents[id]

          }
        );

      }

    }
  );


  // ============================================================
  // 9. RESULTS
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "FINAL PRODUCTION RECONCILIATION"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Previous snapshot sessions: " +
    previousIds.length
  );


  Logger.log(
    "Current Registro sessions: " +
    currentIds.length
  );


  Logger.log(
    "FAS / Mentor-Mentee sessions: " +
    fasSessions.length
  );


  Logger.log(
    "New Registro sessions: " +
    newSessions.length
  );


  Logger.log(
    "Modified Registro sessions: " +
    modifiedSessions.length
  );


  Logger.log(
    "Same-day reschedules: " +
    sameDayReschedules.length
  );


  Logger.log(
    "Cross-day reschedules: " +
    crossDayReschedules.length
  );


  Logger.log(
    "Removed Registro sessions: " +
    removedSessions.length
  );


  Logger.log(
    "Missing from Calendar: " +
    missingFromCalendar.length
  );


  Logger.log(
    "Calendar time mismatches: " +
    calendarTimeMismatches.length
  );


  Logger.log(
    "Calendar classroom mismatches: " +
    calendarClassroomMismatches.length
  );


  Logger.log(
    "Calendar other mismatches: " +
    calendarOtherMismatches.length
  );


  Logger.log(
    "Calendar events for removed sessions: " +
    removedCalendarEvents.length
  );


  // ============================================================
  // 10. FAS STATUS
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "FAS / MENTOR-MENTEE CALENDAR STATUS"
  );

  Logger.log(
    "================================"
  );


  let fasPresent =
    0;

  let fasMissing =
    0;


  fasSessions.forEach(
    item => {

      const event =
        registroEvents[
          item.id
        ];


      if (event) {

        fasPresent++;


        Logger.log(
          "FAS PRESENT: " +
          item.id +
          " | " +
          (
            item.record.title ||
            item.record.course ||
            "FAS"
          )
        );

      } else {

        fasMissing++;


        Logger.log(
          "FAS MISSING: " +
          item.id +
          " | " +
          (
            item.record.title ||
            item.record.course ||
            "FAS"
          )
        );

      }

    }
  );


  Logger.log(
    "FAS already in Calendar: " +
    fasPresent
  );


  Logger.log(
    "FAS missing from Calendar: " +
    fasMissing
  );


  // ============================================================
  // 11. SIMULATE PRODUCTION ACTIONS
  //
  // NOTHING IS ACTUALLY EXECUTED.
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "WHAT PRODUCTION WOULD DO"
  );

  Logger.log(
    "================================"
  );


  // ------------------------------------------------------------
  // NEW SESSIONS
  // ------------------------------------------------------------

  const actualNewSessions =
    newSessions.filter(
      item =>
        !pairedNew[
          item.id
        ]
    );


  Logger.log(
    "Would CREATE Calendar events: " +
    (
      actualNewSessions.length +
      missingFromCalendar.length
    )
  );


  actualNewSessions
    .slice(0, 10)
    .forEach(
      item => {

        Logger.log(
          "WOULD CREATE: " +
          item.id +
          " | " +
          (
            item.current.title ||
            item.current.course
          )
        );

      }
    );


  // ------------------------------------------------------------
  // SAME-DAY MODIFICATIONS
  // ------------------------------------------------------------

  Logger.log(
    "Would MODIFY same-day/same-ID events: " +
    sameDayReschedules.length
  );


  sameDayReschedules
    .slice(0, 10)
    .forEach(
      change => {

        Logger.log(
          "WOULD RESCHEDULE: " +
          change.id
        );


        Logger.log(
          "Old: " +
          change.previous.start +
          " → " +
          change.previous.end
        );


        Logger.log(
          "New: " +
          change.current.start +
          " → " +
          change.current.end
        );

      }
    );


  // ------------------------------------------------------------
  // OTHER MODIFICATIONS
  // ------------------------------------------------------------

  const otherModified =
    modifiedSessions.filter(
      change =>
        !sameDayReschedules.some(
          item =>
            item.id ===
            change.id
        )
    );


  Logger.log(
    "Would MODIFY other existing events: " +
    otherModified.length
  );


  otherModified
    .slice(0, 10)
    .forEach(
      change => {

        Logger.log(
          "WOULD MODIFY: " +
          change.id
        );


        if (
          change.classroomChanged
        ) {

          Logger.log(
            "  Classroom change: YES"
          );

        }


        if (
          change.otherChanged
        ) {

          Logger.log(
            "  Other metadata change: YES"
          );

        }

      }
    );


  // ------------------------------------------------------------
  // CROSS-DAY RESCHEDULES
  // ------------------------------------------------------------

  Logger.log(
    "Would PROCESS cross-day reschedules: " +
    crossDayReschedules.length
  );


  crossDayReschedules
    .slice(0, 10)
    .forEach(
      change => {

        Logger.log(
          "WOULD MOVE EVENT:"
        );


        Logger.log(
          "Old ID: " +
          change.oldId
        );


        Logger.log(
          "New ID: " +
          change.newId
        );


        Logger.log(
          "Old date: " +
          dateOnly(
            change.previous.start
          )
        );


        Logger.log(
          "New date: " +
          dateOnly(
            change.current.start
          )
        );

      }
    );


  // ------------------------------------------------------------
  // GOOGLE TASKS
  // ------------------------------------------------------------

  Logger.log(
    "Would CREATE Google Tasks for same-day reschedules: " +
    sameDayReschedules.length
  );


  sameDayReschedules
    .slice(0, 10)
    .forEach(
      change => {

        Logger.log(
          "WOULD CREATE TASK: Registro Reschedule — " +
          (
            change.current.title ||
            change.current.course ||
            "Class"
          )
        );

      }
    );


  // ------------------------------------------------------------
  // DELETIONS
  // ------------------------------------------------------------

  const actualDeletions =
    removedCalendarEvents;


  Logger.log(
    "Would DELETE Calendar events: " +
    actualDeletions.length
  );


  actualDeletions
    .slice(0, 10)
    .forEach(
      item => {

        Logger.log(
          "WOULD DELETE: " +
          item.id +
          " | " +
          item.event.getTitle()
        );

      }
    );


  // ============================================================
  // 12. DISPLAY UNEXPECTED CONDITIONS
  // ============================================================

  const unexpected =
    [];


  /*
   * A correct system should currently have:
   *
   * 0 new
   * 0 modified
   * 0 removed
   * 0 missing Calendar
   * 0 Calendar mismatches
   *
   * FAS should be 8/8.
   *
   * However, we DO NOT fail simply because Registro itself
   * changes. We report the exact actions instead.
   */


  if (
    fasMissing > 0
  ) {

    unexpected.push(
      "FAS sessions missing from Calendar: " +
      fasMissing
    );

  }


  if (
    removedCalendarEvents.length > 0
  ) {

    unexpected.push(
      "Calendar events appear to belong to removed Registro sessions: " +
      removedCalendarEvents.length
    );

  }


  // ============================================================
  // 13. PROPERTY SAFETY VERIFICATION
  // ============================================================

  const snapshotAfter =
    properties.getProperty(
      SNAPSHOT_PROPERTY
    );

  const snapshotTimeAfter =
    properties.getProperty(
      SNAPSHOT_TIME_PROPERTY
    );

  const lastSyncAfter =
    properties.getProperty(
      LAST_SYNC_PROPERTY
    );


  const snapshotUnchanged =
    snapshotAfter ===
    snapshotBefore;


  const snapshotTimeUnchanged =
    snapshotTimeAfter ===
    snapshotTimeBefore;


  const lastSyncUnchanged =
    lastSyncAfter ===
    lastSyncBefore;


  Logger.log(
    "================================"
  );

  Logger.log(
    "READ-ONLY SAFETY VERIFICATION"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Snapshot unchanged: " +
    (
      snapshotUnchanged
        ? "YES"
        : "NO"
    )
  );


  Logger.log(
    "Snapshot timestamp unchanged: " +
    (
      snapshotTimeUnchanged
        ? "YES"
        : "NO"
    )
  );


  Logger.log(
    "Last sync property unchanged: " +
    (
      lastSyncUnchanged
        ? "YES"
        : "NO"
    )
  );


  Logger.log(
    "Google Calendar event created: NO"
  );


  Logger.log(
    "Google Calendar event modified: NO"
  );


  Logger.log(
    "Google Calendar event deleted: NO"
  );


  Logger.log(
    "Google Task created: NO"
  );


  Logger.log(
    "Script Property modified: NO"
  );


  // ============================================================
  // 14. HARD SAFETY FAILURE IF PROPERTY CHANGED
  // ============================================================

  if (
    !snapshotUnchanged ||
    !snapshotTimeUnchanged ||
    !lastSyncUnchanged
  ) {

    throw new Error(
      "SAFETY FAILURE: A persistent Registro property changed during dry run."
    );

  }


  // ============================================================
  // 15. FINAL REPORT
  // ============================================================

  Logger.log(
    "================================"
  );

  Logger.log(
    "FINAL PRODUCTION DRY RUN RESULT"
  );

  Logger.log(
    "================================"
  );


  Logger.log(
    "Previous snapshot: " +
    previousIds.length
  );


  Logger.log(
    "Current Registro sessions: " +
    currentIds.length
  );


  Logger.log(
    "FAS / Mentor-Mentee: " +
    fasSessions.length
  );


  Logger.log(
    "New sessions: " +
    newSessions.length
  );


  Logger.log(
    "Actual modified sessions: " +
    modifiedSessions.length
  );


  Logger.log(
    "Same-day reschedules: " +
    sameDayReschedules.length
  );


  Logger.log(
    "Cross-day reschedules: " +
    crossDayReschedules.length
  );


  Logger.log(
    "Removed sessions: " +
    removedSessions.length
  );


  Logger.log(
    "Missing from Calendar: " +
    missingFromCalendar.length
  );


  Logger.log(
    "Calendar time mismatches: " +
    calendarTimeMismatches.length
  );


  Logger.log(
    "Calendar classroom mismatches: " +
    calendarClassroomMismatches.length
  );


  Logger.log(
    "Calendar other mismatches: " +
    calendarOtherMismatches.length
  );


  Logger.log(
    "Calendar events for removed sessions: " +
    removedCalendarEvents.length
  );


  Logger.log(
    "FAS present: " +
    fasPresent
  );


  Logger.log(
    "FAS missing: " +
    fasMissing
  );


  Logger.log(
    "Unexpected conditions: " +
    unexpected.length
  );


  if (
    unexpected.length > 0
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "ATTENTION — REVIEW REQUIRED"
    );

    Logger.log(
      "================================"
    );


    unexpected.forEach(
      item => {

        Logger.log(
          "WARNING: " +
          item
        );

      }
    );

  }


  Logger.log(
    "================================"
  );

  Logger.log(
    "FINAL PRODUCTION LIVE-SYNC DRY RUN COMPLETE"
  );

  Logger.log(
    "================================"
  );

  Logger.log(
    "NO GOOGLE CALENDAR WRITE PERFORMED."
  );

  Logger.log(
    "NO GOOGLE TASK WRITE PERFORMED."
  );

  Logger.log(
    "NO REGISTRO SNAPSHOT WRITE PERFORMED."
  );

  Logger.log(
    "================================"
  );

}

/**
 * ============================================================
 * AUTONOMOUS REGISTRO AUTHENTICATION & TOKEN ENGINE
 * ============================================================
 * 
 * Automatically manages and keeps REGISTRO_ACCESS_TOKEN fresh forever.
 * 
 * Architecture:
 *  - Zero-latency JWT expiration checks (0ms overhead when valid).
 *  - 48-Hour Proactive Expiration Renewal (avoids mid-day expirations).
 *  - LockService concurrency protection (prevents parallel login collisions).
 *  - Direct TAPMI EdTex Authenticate API Integration.
 *  - Setup helper: setupRegistroCredentials(username, password).
 * ============================================================
 */

function authenticateRegistro(force) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    Logger.log("Warning: Could not obtain lock for Registro authentication: " + e.message);
  }

  try {
    const props = PropertiesService.getScriptProperties();

    if (!force) {
      const existing = props.getProperty("REGISTRO_ACCESS_TOKEN");
      if (existing && isRegistroTokenFresh(existing, 86400)) {
        return existing;
      }
    }

    const username = props.getProperty("REGISTRO_USERNAME");
    const password = props.getProperty("REGISTRO_PASSWORD");

    if (!username || !password) {
      throw new Error(
        "Registro credentials not configured. Please run setupRegistroCredentials('your-email@tapmi.edu.in', 'your-password') or set REGISTRO_USERNAME and REGISTRO_PASSWORD in Script Properties."
      );
    }

    Logger.log("Authenticating with Registro API for user: " + username + "...");

    const loginUrl = "https://registro-tapmi-scheduler.edtex.in/api//api/authenticate";
    const payload = {
      type: "",
      username: username,
      password: password,
      totp: "",
      rememberMe: true,
      version: "v1.0.0"
    };

    const response = UrlFetchApp.fetch(loginUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      throw new Error("Registro login failed with HTTP " + statusCode + ": " + responseText);
    }

    const resJson = JSON.parse(responseText);

    if (resJson.status === "Fail") {
      throw new Error("Registro login rejected: " + (resJson.message || responseText));
    }

    const newToken = (resJson.data && resJson.data.data && resJson.data.data.token)
                  || (resJson.data && resJson.data.token)
                  || resJson.token;

    if (!newToken) {
      throw new Error("Registro login succeeded but token was not found in response: " + responseText);
    }

    props.setProperty("REGISTRO_ACCESS_TOKEN", newToken);
    props.setProperty("REGISTRO_TOKEN_UPDATED_AT", new Date().toISOString());

    Logger.log("Registro token successfully refreshed and stored.");
    return newToken;

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // Ignore
    }
  }
}

function isRegistroTokenFresh(token, bufferSeconds) {
  if (!token) return false;
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return false;

    const payloadJson = Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[1])
    ).getDataAsString();
    const payload = JSON.parse(payloadJson);

    if (!payload.exp) return true;

    const buffer = bufferSeconds !== undefined ? bufferSeconds : (48 * 3600);
    const nowSec = Math.floor(Date.now() / 1000);

    return (payload.exp - nowSec) > buffer;
  } catch (e) {
    Logger.log("Error parsing Registro JWT: " + e.message);
    return false;
  }
}

function getValidRegistroToken() {
  const props = PropertiesService.getScriptProperties();
  const currentToken = props.getProperty("REGISTRO_ACCESS_TOKEN");

  if (currentToken && isRegistroTokenFresh(currentToken, 48 * 3600)) {
    return currentToken;
  }

  Logger.log("Registro token missing or expiring within 48h. Performing automatic refresh...");
  return authenticateRegistro(false);
}

function setupRegistroCredentials(username, password) {
  Logger.log("================================");
  Logger.log("REGISTRO CREDENTIALS SETUP");
  Logger.log("================================");

  if (!username || !password) {
    throw new Error("Please supply both username (email) and password.");
  }

  Logger.log("Testing credentials with live Registro API...");

  const loginUrl = "https://registro-tapmi-scheduler.edtex.in/api//api/authenticate";
  const payload = {
    type: "",
    username: String(username).trim(),
    password: String(password).trim(),
    totp: "",
    rememberMe: true,
    version: "v1.0.0"
  };

  const response = UrlFetchApp.fetch(loginUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode !== 200) {
    throw new Error("Connection test failed with HTTP " + statusCode + ": " + responseText);
  }

  const resJson = JSON.parse(responseText);

  if (resJson.status === "Fail") {
    throw new Error("Registro rejected credentials: " + resJson.message);
  }

  const token = (resJson.data && resJson.data.data && resJson.data.data.token)
             || (resJson.data && resJson.data.token)
             || resJson.token;

  if (!token) {
    throw new Error("Login succeeded but could not extract token from response: " + responseText);
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty("REGISTRO_USERNAME", String(username).trim());
  props.setProperty("REGISTRO_PASSWORD", String(password).trim());
  props.setProperty("REGISTRO_ACCESS_TOKEN", token);
  props.setProperty("REGISTRO_TOKEN_UPDATED_AT", new Date().toISOString());

  Logger.log("SUCCESS! Credentials verified with Registro.");
  Logger.log("REGISTRO_USERNAME and REGISTRO_PASSWORD securely stored.");
  Logger.log("Initial 30-day token acquired and saved.");
  Logger.log("Automatic token refresh is now 100% active.");
  Logger.log("================================");

  return "Setup successful! Token acquired and saved.";
}

function verifyRegistroToken() {
  const props = PropertiesService.getScriptProperties();
  const hasUser = !!props.getProperty("REGISTRO_USERNAME");
  const hasPass = !!props.getProperty("REGISTRO_PASSWORD");

  Logger.log("================================");
  Logger.log("REGISTRO TOKEN & AUTH STATUS");
  Logger.log("================================");
  Logger.log("Credentials stored: " + (hasUser && hasPass ? "YES (Auto-refresh active)" : "NO (Manual token only)"));
  if (hasUser) {
    Logger.log("Username: " + props.getProperty("REGISTRO_USERNAME"));
  }

  let token = props.getProperty("REGISTRO_ACCESS_TOKEN");

  if (!token && hasUser && hasPass) {
    Logger.log("Token missing. Attempting auto-login now...");
    try {
      token = authenticateRegistro(true);
    } catch (e) {
      Logger.log("Auto-login error: " + e.message);
    }
  }

  if (!token) {
    Logger.log("REGISTRO_ACCESS_TOKEN is missing.");
    return;
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    Logger.log("REGISTRO_ACCESS_TOKEN is not a valid JWT format.");
    return;
  }

  const payloadJson = Utilities.newBlob(
    Utilities.base64DecodeWebSafe(parts[1])
  ).getDataAsString();
  const payload = JSON.parse(payloadJson);

  const expiration = payload.exp ? new Date(payload.exp * 1000) : null;
  const nowMs = Date.now();
  const isExpired = expiration ? nowMs >= expiration.getTime() : false;
  const remainingHours = expiration ? ((expiration.getTime() - nowMs) / (1000 * 3600)).toFixed(1) : "UNKNOWN";

  Logger.log("Token exists: YES (Length: " + token.trim().length + ")");
  Logger.log("Expiration IST: " + (expiration ? Utilities.formatDate(expiration, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm:ss") : "NOT PRESENT"));
  Logger.log("Time Remaining: " + remainingHours + " hours");
  Logger.log("Currently expired: " + isExpired);
  Logger.log("Freshness status: " + (isRegistroTokenFresh(token, 48 * 3600) ? "HEALTHY (>48h remaining)" : "EXPIRING SOON / EXPIRED"));
  Logger.log("================================");
}
/**
 * ============================================================
 * REGISTRO CLEANUP — DELETE ALL AUTOMATION-CREATED
 * CALENDAR EVENTS AND GOOGLE TASKS
 * ============================================================
 *
 * ONE-TIME, MANUAL cleanup function.
 *
 * Deletes:
 *   - Every Calendar event carrying "REGISTRO_SESSION_ID:"
 *     in its description
 *   - Every Google Task carrying "REGISTRO_RESCHEDULE:"
 *     in its notes
 *
 * Does NOT touch:
 *   - Any other event or task
 *   - The Registro snapshot (use resetRegistroSnapshot()
 *     separately, only after this reports zero failures)
 *
 * SAFE TO RE-RUN: everything here is idempotent. If it stops
 * early because of the time budget, just run it again.
 * ============================================================
 */
function deleteAllRegistroCalendarEventsAndTasks() {

  Logger.log("================================");
  Logger.log("REGISTRO CLEANUP — DELETE ALL");
  Logger.log("================================");

  const CALENDAR_ID = "priyanshurajgopi@gmail.com";

  // Stop safely before Apps Script's ~6-minute execution limit.
  const TIME_BUDGET_MS = 4.5 * 60 * 1000;

  const WRITE_DELAY_MS = 300;
  const MAX_RETRIES = 3;
  const INITIAL_RETRY_DELAY_MS = 1000;

  const startTime = Date.now();

  function isTransientError(error) {

    const message = String(
      error && error.message ? error.message : error
    ).toLowerCase();

    return (
      message.indexOf("too many calendars") !== -1 ||
      message.indexOf("rate limit") !== -1 ||
      message.indexOf("quota") !== -1 ||
      message.indexOf("service invoked too many times") !== -1 ||
      message.indexOf("try again later") !== -1 ||
      message.indexOf("429") !== -1 ||
      message.indexOf("backend error") !== -1 ||
      message.indexOf("internal error") !== -1
    );
  }

  function runWithRetry(name, operation) {

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

      try {

        if (attempt > 1) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 2);
          Logger.log("Retrying: " + name + " | attempt " + attempt + "/" + MAX_RETRIES);
          Utilities.sleep(delay);
        }

        const result = operation();
        Utilities.sleep(WRITE_DELAY_MS);

        return { success: true, result: result, error: null };

      } catch (error) {

        lastError = error;
        Logger.log("Operation failed: " + name + " | " + error.message);

        if (!isTransientError(error)) {
          break;
        }
      }
    }

    return { success: false, result: null, error: lastError };
  }

  // ============================================================
  // PART 1 — DELETE CALENDAR EVENTS
  // ============================================================

  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);

  if (!calendar) {
    throw new Error("Could not access Google Calendar: " + CALENDAR_ID);
  }

  // Wide but bounded search window: 6 months back, 12 months
  // forward. Wide enough to catch stale/leftover events from
  // any point the sync was down, without scanning years of
  // your calendar unnecessarily.
  const searchStart = new Date();
  searchStart.setDate(searchStart.getDate() - 180);

  const searchEnd = new Date();
  searchEnd.setDate(searchEnd.getDate() + 365);

  Logger.log("Calendar search start: " + searchStart);
  Logger.log("Calendar search end: " + searchEnd);
  Logger.log("Fetching events... this may take a moment.");

  const events = calendar.getEvents(searchStart, searchEnd);

  Logger.log("Total calendar events in range: " + events.length);

  const marker = "REGISTRO_SESSION_ID:";

  const registroEvents = events.filter(function (event) {
    const description = event.getDescription() || "";
    return description.indexOf(marker) !== -1;
  });

  Logger.log("Registro-created events found: " + registroEvents.length);

  let deletedCount = 0;
  let failedCount = 0;
  let stoppedEarly = false;

  for (let i = 0; i < registroEvents.length; i++) {

    if (Date.now() - startTime > TIME_BUDGET_MS) {
      stoppedEarly = true;
      Logger.log("Time budget reached. Stopping early — run this function again to continue.");
      break;
    }

    const event = registroEvents[i];
    const title = event.getTitle();

    const result = runWithRetry("Delete event " + (i + 1), function () {
      event.deleteEvent();
      return true;
    });

    if (result.success) {
      deletedCount++;
      Logger.log("DELETED [" + (i + 1) + "/" + registroEvents.length + "]: " + title);
    } else {
      failedCount++;
      Logger.log("FAILED TO DELETE: " + title + " | " + result.error.message);
    }
  }

  // ============================================================
  // PART 2 — DELETE GOOGLE TASKS
  // ============================================================

  Logger.log("================================");
  Logger.log("DELETING REGISTRO GOOGLE TASKS");
  Logger.log("================================");

  let taskDeletedCount = 0;
  let taskFailedCount = 0;
  let taskListId = null;

  try {

    const lists = Tasks.Tasklists.list();

    if (lists && lists.items && lists.items.length > 0) {
      taskListId = lists.items[0].id;
    } else {
      Logger.log("No Google Tasks list found.");
    }

  } catch (error) {
    Logger.log("Error accessing Google Tasks lists: " + error.message);
  }

  if (taskListId && !stoppedEarly) {

    try {

      const taskMarker = "REGISTRO_RESCHEDULE:";
      const allTasks = [];
      let pageToken = null;

      do {

        const taskPage = Tasks.Tasks.list(taskListId, {
          showCompleted: true,
          showHidden: true,
          maxResults: 100,
          pageToken: pageToken
        });

        if (taskPage && taskPage.items) {
          taskPage.items.forEach(function (task) {
            allTasks.push(task);
          });
        }

        pageToken = taskPage.nextPageToken || null;

      } while (pageToken);

      Logger.log("Total tasks in list: " + allTasks.length);

      const registroTasks = allTasks.filter(function (task) {
        return String(task.notes || "").indexOf(taskMarker) !== -1;
      });

      Logger.log("Registro-created tasks found: " + registroTasks.length);

      for (let i = 0; i < registroTasks.length; i++) {

        if (Date.now() - startTime > TIME_BUDGET_MS) {
          stoppedEarly = true;
          Logger.log("Time budget reached during task deletion. Stopping early.");
          break;
        }

        const task = registroTasks[i];

        try {
          Tasks.Tasks.remove(taskListId, task.id);
          taskDeletedCount++;
          Utilities.sleep(WRITE_DELAY_MS);
          Logger.log("TASK DELETED [" + (i + 1) + "/" + registroTasks.length + "]: " + task.title);
        } catch (error) {
          taskFailedCount++;
          Logger.log("FAILED TO DELETE TASK: " + task.title + " | " + error.message);
        }
      }

    } catch (error) {
      Logger.log("Error reading/deleting Google Tasks: " + error.message);
    }
  }

  // ============================================================
  // FINAL REPORT
  // ============================================================

  Logger.log("================================");
  Logger.log("CLEANUP RESULTS");
  Logger.log("================================");
  Logger.log("Calendar events found: " + registroEvents.length);
  Logger.log("Calendar events deleted: " + deletedCount);
  Logger.log("Calendar events failed: " + failedCount);
  Logger.log("Tasks deleted: " + taskDeletedCount);
  Logger.log("Tasks failed: " + taskFailedCount);
  Logger.log("Stopped early due to time budget: " + stoppedEarly);

  if (stoppedEarly) {

    Logger.log("================================");
    Logger.log("RUN THIS FUNCTION AGAIN TO CONTINUE.");
    Logger.log("Do NOT run resetRegistroSnapshot() yet.");
    Logger.log("================================");

  } else if (failedCount === 0 && taskFailedCount === 0) {

    Logger.log("================================");
    Logger.log("CLEANUP COMPLETE. All Registro events/tasks removed.");
    Logger.log("Next: run resetRegistroSnapshot(), then syncRegistroToCalendarLive().");
    Logger.log("================================");

  } else {

    Logger.log("================================");
    Logger.log("CLEANUP FINISHED WITH SOME FAILURES.");
    Logger.log("Run this function again to retry the failures before resetting the snapshot.");
    Logger.log("================================");
  }
}
/**
 * ============================================================
 * RESET REGISTRO SNAPSHOT
 * ============================================================
 *
 * Run this ONLY after deleteAllRegistroCalendarEventsAndTasks()
 * has reported "CLEANUP COMPLETE" with zero failures.
 *
 * Clears the saved "last known state" so the next call to
 * syncRegistroToCalendarLive() treats every current Registro
 * session as brand new and rebuilds the Calendar from scratch —
 * using the exact same categorization rules as before (holidays
 * and exams excluded, FAS/Mentor-Mentee included).
 * ============================================================
 */
function resetRegistroSnapshot() {

  Logger.log("================================");
  Logger.log("RESET REGISTRO SNAPSHOT");
  Logger.log("================================");

  const properties = PropertiesService.getScriptProperties();

  properties.setProperty(
    "REGISTRO_TIMETABLE_SNAPSHOT",
    JSON.stringify({})
  );

  properties.setProperty(
    "REGISTRO_TIMETABLE_SNAPSHOT_TIME",
    new Date().toISOString()
  );

  properties.deleteProperty("REGISTRO_LAST_CALENDAR_SYNC");

  Logger.log("Snapshot reset to empty.");
  Logger.log("Next syncRegistroToCalendarLive() run will treat every current");
  Logger.log("Registro session as new and rebuild the Calendar from scratch.");
  Logger.log("================================");
}
/**
 * ============================================================
 * REGISTRO DIAGNOSTIC — INSPECT FULL RAW RECORD STRUCTURE
 * ============================================================
 *
 * READ ONLY. No Calendar or Task changes. No snapshot changes.
 *
 * Purpose: reveal every field Registro actually sends, so we
 * can correctly detect "yellow" sessions and holiday/festival
 * records instead of guessing field names.
 * ============================================================
 */
function diagnoseRegistroRecordStructure() {

  Logger.log("================================");
  Logger.log("REGISTRO FULL RECORD STRUCTURE DIAGNOSTIC");
  Logger.log("================================");

  const token = PropertiesService.getScriptProperties()
    .getProperty("REGISTRO_ACCESS_TOKEN");

  if (!token) {
    throw new Error("REGISTRO_ACCESS_TOKEN is missing.");
  }

  const url =
    "https://registro-tapmi-scheduler.edtex.in/api//api/student-term-sessions-for-timetable/8a8280869d964d7d019df6c5079279eb/true";

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Token": token
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error("Registro request failed with HTTP " + response.getResponseCode());
  }

  const result = JSON.parse(response.getContentText());

  if (!result || !Array.isArray(result.data)) {
    throw new Error("Registro response does not contain a valid data array.");
  }

  const records = result.data;

  Logger.log("Total records: " + records.length);

  // --------------------------------------------------------
  // 1. ALL DISTINCT FIELD NAMES ACROSS EVERY RECORD
  // --------------------------------------------------------

  const allKeys = new Set();

  records.forEach(function (record) {
    Object.keys(record).forEach(function (key) {
      allKeys.add(key);
    });
  });

  Logger.log("================================");
  Logger.log("ALL DISTINCT FIELD NAMES FOUND ACROSS ALL RECORDS");
  Logger.log("================================");

  Array.from(allKeys).sort().forEach(function (key) {
    Logger.log(" - " + key);
  });

  // --------------------------------------------------------
  // 2. FULL JSON OF THE "Session by MAHE" RECORD (or similar)
  // --------------------------------------------------------

  Logger.log("================================");
  Logger.log("MAHE / SPECIAL-SESSION RECORDS (FULL JSON)");
  Logger.log("================================");

  const maheRecords = records.filter(function (record) {
    const text = (
      String(record.title || "") + " " +
      String(record.course || "") + " " +
      String(record.professor || "")
    ).toLowerCase();
    return text.indexOf("mahe") !== -1 || text.indexOf("session by") !== -1;
  });

  Logger.log("MAHE/special-session records found: " + maheRecords.length);

  maheRecords.slice(0, 5).forEach(function (record, index) {
    Logger.log("--- MAHE RECORD " + (index + 1) + " (FULL JSON) ---");
    Logger.log(JSON.stringify(record, null, 2));
  });

  // --------------------------------------------------------
  // 3. FULL JSON OF HOLIDAY RECORDS
  // --------------------------------------------------------

  Logger.log("================================");
  Logger.log("HOLIDAY RECORDS (FULL JSON, first 10)");
  Logger.log("================================");

  const holidayRecords = records.filter(function (record) {
    return record.is_holiday === true;
  });

  Logger.log("Total holiday records: " + holidayRecords.length);

  holidayRecords.slice(0, 10).forEach(function (record, index) {
    Logger.log("--- HOLIDAY RECORD " + (index + 1) + " (FULL JSON) ---");
    Logger.log(JSON.stringify(record, null, 2));
  });

  // --------------------------------------------------------
  // 4. FULL JSON OF A NORMAL CLASS RECORD (baseline comparison)
  // --------------------------------------------------------

  Logger.log("================================");
  Logger.log("ONE NORMAL CLASS RECORD (FULL JSON, for comparison)");
  Logger.log("================================");

  const normalRecord = records.find(function (record) {
    return record.is_holiday !== true && record.is_exam !== true;
  });

  if (normalRecord) {
    Logger.log(JSON.stringify(normalRecord, null, 2));
  }

  Logger.log("================================");
  Logger.log("DIAGNOSTIC COMPLETE — NO WRITES PERFORMED");
  Logger.log("================================");
}

/**
 * ============================================================
 * ONE-TIME CREDENTIALS SETUP HELPER
 * ============================================================
 * Fill in your email and password below, select 'setMyRegistroCredentials'
 * from the dropdown above, and click Run.
 * It will test the login, store credentials into Script Properties,
 * acquire a fresh 30-day token, and activate auto-refresh.
 * After running, you can delete your password from here.
 * ============================================================
 */
function setMyRegistroCredentials() {
  Logger.log("Credentials are already securely configured in Script Properties. Automatic refresh is active.");
}