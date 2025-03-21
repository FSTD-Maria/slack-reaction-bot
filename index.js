const express = require('express');
const bodyParser = require('body-parser');
const { WebClient } = require('@slack/web-api');

const app = express();
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
app.use(bodyParser.json());

app.post('/slack/events', async (req, res) => {
  const { type, event } = req.body;

  if (type === 'url_verification') {
    return res.status(200).send(req.body.challenge);
  }

  if (event && event.type === 'reaction_added') {
    const { reaction, item } = event;

    const result = await slack.conversations.replies({
      channel: item.channel,
      ts: item.ts,
    });

    const originalMsg = result.messages[0].text;
    const requestType = detectRequestType(originalMsg);
    let response = "";

    if (reaction === "white_check_mark") {
      response = getApprovedMessage(requestType);
    } else if (reaction === "x") {
      response = getDeniedMessage(requestType);
    }

    if (response) {
      await slack.chat.postMessage({
        channel: item.channel,
        thread_ts: item.ts,
        text: response,
      });
    }

    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

function detectRequestType(text) {
  if (text.includes("PTO")) return "PTO Request";
  if (text.includes("VTO Request with coupon")) return "VTO Request with coupon";
  if (text.includes("No VTO Coupon")) return "No VTO Coupon";
  if (text.includes("Schedule Change Request")) return "Schedule Change Request";
  return "Other";
}

function getApprovedMessage(type) {
  switch (type) {
    case "PTO Request": return "✅ Your request has been approved. Please submit your ADP request immediately.";
    case "VTO Request with coupon": return "✅ Your request has been approved. A supervisor will remove you from the schedule for the requested time.";
    case "Schedule Change Request": return "🔄 Your schedule change has been approved. A supervisor will modify your schedule accordingly.";
    default: return "";
  }
}

function getDeniedMessage(type) {
  switch (type) {
    case "PTO Request": return "❌ Your request has been denied. Please report for your shift as scheduled.";
    case "VTO Request with coupon": return "❌ Your request has been denied. Please show up for your scheduled shift.";
    case "No VTO Coupon": return "❌ Your request has been denied. You must have a VTO coupon in order request.";
    case "Schedule Change Request": return "❌ Your request has been denied. Please continue your current schedule.";
    default: return "";
  }
}

app.listen(process.env.PORT || 3000, () => console.log("Server is running"));
