var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/sms-status", (req, res) => {
    const isTwilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
    res.json({
      configured: isTwilioConfigured,
      message: isTwilioConfigured ? "Twilio SMS gateway is online. Real SMS OTP will be delivered directly to mobile devices!" : "Twilio SMS gateway is offline. Running in secure demo mode."
    });
  });
  app.post("/api/send-otp", async (req, res) => {
    const { phoneNumber, otpCode } = req.body;
    if (!phoneNumber || !otpCode) {
      res.status(400).json({ error: "Phone number and OTP code are required" });
      return;
    }
    let formattedPhone = phoneNumber.trim();
    if (/^[9][678]\d{8}$/.test(formattedPhone)) {
      formattedPhone = "+977" + formattedPhone;
    }
    const message = `eSewa Security Code: ${otpCode}. Valid for 5 minutes. Do not share this OTP with anyone.`;
    console.log(`[SMS OTP] Attempting to send code ${otpCode} to ${formattedPhone}`);
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        console.log("[SMS OTP] Using Twilio service to send real OTP...");
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
        const params = new URLSearchParams();
        params.append("To", formattedPhone);
        params.append("From", twilioPhoneNumber);
        params.append("Body", message);
        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        });
        const data = await response.json();
        if (response.ok) {
          console.log("[SMS OTP] Twilio OTP sent successfully:", data.sid);
          res.json({
            success: true,
            provider: "twilio",
            message: "Real-time OTP sent successfully to " + formattedPhone,
            sid: data.sid
          });
          return;
        } else {
          console.error("[SMS OTP] Twilio error response:", data);
          throw new Error(data.message || "Twilio request failed");
        }
      } catch (err) {
        console.error("[SMS OTP] Twilio Service Failed, trying fallback...", err.message);
      }
    } else {
      console.log("[SMS OTP] Twilio credentials missing in Environment.");
    }
    if (formattedPhone.startsWith("+977")) {
      console.log(`[SMS OTP] Sandbox simulator active for Nepalese number ${formattedPhone}. Direct SMS requires Twilio variables.`);
      res.json({
        success: false,
        provider: "sandbox",
        info: "Direct SMS carrier setup required for Nepalese numbers.",
        fallbackOTP: otpCode,
        message: "To enable direct live carrier SMS to Nepal, please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in the Secrets/Environment panel."
      });
      return;
    }
    try {
      console.log("[SMS OTP] Trying Textbelt free public gateway fallback...");
      const textbeltResponse = await fetch("https://textbelt.com/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message,
          key: "textbelt"
        })
      });
      const textbeltData = await textbeltResponse.json();
      console.log("[SMS OTP] Textbelt status checked");
      if (textbeltData.success) {
        res.json({
          success: true,
          provider: "textbelt",
          message: "Real-time OTP sent successfully using Textbelt fallback to " + formattedPhone,
          quotaRemaining: textbeltData.quotaRemaining
        });
        return;
      } else {
        console.log("[SMS OTP] Textbelt is currently unavailable or quota limit is reached.");
        res.json({
          success: false,
          provider: "failed",
          info: "Gateway offline. Sandbox mode active.",
          fallbackOTP: otpCode,
          message: "SMS limits reached. To enable unlimited real-time phone SMS OTP, configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in the Secrets / Environment panel."
        });
        return;
      }
    } catch (fallbackErr) {
      console.log("[SMS OTP] Fallback service unavailable, using local sandbox verification code.");
      res.json({
        success: false,
        provider: "failed",
        fallbackOTP: otpCode,
        message: "Failed to dispatch real SMS. Please configure Twilio credentials in your Environment variables for reliable delivery."
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
