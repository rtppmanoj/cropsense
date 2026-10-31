import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { Twilio } from "npm:twilio@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SmsRequest {
  phoneNumber: string;
  recommendations: string[];
  location: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get request data
    const { phoneNumber, recommendations, location } = await req.json() as SmsRequest;

    // Validate phone number (Indian format)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Initialize Twilio client
    const twilioClient = new Twilio(
      Deno.env.get("TWILIO_ACCOUNT_SID") || "",
      Deno.env.get("TWILIO_AUTH_TOKEN") || ""
    );

    // Prepare message text
    const messageText = `CropSense Recommendation for ${location}:\n\n` +
      `Top recommended crops:\n${recommendations.join(", ")}\n\n` +
      `For more details, visit: ${Deno.env.get("PUBLIC_SITE_URL")}`;

    // Send SMS
    const message = await twilioClient.messages.create({
      body: messageText,
      to: `+91${phoneNumber}`,
      from: Deno.env.get("TWILIO_PHONE_NUMBER") || "",
    });

    // Store SMS record in Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    await supabase.from("sms_logs").insert({
      phone_number: phoneNumber,
      message: messageText,
      status: message.status,
      twilio_sid: message.sid,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: message.sid }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send SMS" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});