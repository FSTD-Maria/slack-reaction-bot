const express = require('express');
const bodyParser = require('body-parser');
const { WebClient } = require('@slack/web-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const app = express();
app.use(bodyParser.json());

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// ✅ Only the Sheet ID here, not the full URL
const doc = new GoogleSpreadsheet('1GVq7TqDoR7aAE2XhxhIUyBiTw3CuAhAxeigDfCJ51f4'); 
const creds = require('/etc/secrets/service_account.json');

const AUTHORIZED_USERS = ["U07AZN6422G", "U048T67N45S", "U062F7423D4", "UH2J709L7"];

app.post('/slack/events', async (req, res) => {
  const { type, event } = req.body;

  if (type === 'url_verification') {
    return res.status(200).send(req.body.challenge);
  }

  if (event && event.type === 'reaction_added') {
    const { reaction, user, item } = event;

    if (!AUTHORIZED_USERS.includes(user)) return res.sendStatus(200);

    try {
      await doc.useServiceAccountAuth(creds);
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];
      const rows = await sheet.getRows();

      const targetRow = rows.find(row => row._rawData[16] === item.ts); // Column Q

      if (!targetRow) return res.sendStatus(200);

      const requestType = targetRow._rawData[1]; // Column B
      const hasCoupon = targetRow._rawData[5];   // Column F
      const approved = reaction === "white_check_mark";

      let response = "";

      if (requestType.includes("VTO") && hasCoupon.toUpperCase() === "NO") {
        response = "❌ Your request has been denied. You must have a VTO coupon in order to request.";
      } else if (requestType.includes("PTO")) {
        response = approved
          ? "✅ Your request has been approved. Please submit your ADP request immediately."
          : "❌ Your request has been denied. Please report for your shift as scheduled.";
      } else if (requestType.includes("VTO")) {
        response = approved
          ? "✅ Your request has been approved. A supervisor will remove you from the schedule for the requested time."
          : "❌ Your request has been denied. Please show up for your scheduled shift.";
      } else if (requestType.includes("Schedule Change")) {
        response = approved
          ? "🔄 Your schedule change has been approved. A supervisor will modify your schedule accordingly."
          : "❌ Your request has been denied. Please continue your current schedule.";
      }

      await slack.chat.postMessage({
        channel: item.channel,
        thread_ts: item.ts,
        text: response,
      });

      targetRow._rawData[13] = approved ? "Approved" : "Denied"; // Column N
      await targetRow.save();

    } catch (error) {
      console.error("Error processing reaction:", error);
    }

    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send('Slack bot is running ✅');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
