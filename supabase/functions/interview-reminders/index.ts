import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Interview {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  location_type: string;
  location_details: string | null;
  subject: string | null;
  applicant_id: string;
  employer_id: string;
  job_postings: {
    title: string;
  } | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Interview reminders cron job started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    
    // Find interviews starting in 9-11 minutes (giving 1 minute buffer for cron timing)
    const nineMinutesFromNow = new Date(now.getTime() + 9 * 60 * 1000);
    const elevenMinutesFromNow = new Date(now.getTime() + 11 * 60 * 1000);

    console.log(`Looking for confirmed interviews between ${nineMinutesFromNow.toISOString()} and ${elevenMinutesFromNow.toISOString()}`);

    // Get confirmed interviews starting in ~10 minutes
    const { data: upcomingInterviews, error: interviewsError } = await supabase
      .from("interviews")
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        location_type,
        location_details,
        subject,
        applicant_id,
        employer_id,
        job_postings(title)
      `)
      .eq("status", "confirmed")
      .gte("scheduled_at", nineMinutesFromNow.toISOString())
      .lte("scheduled_at", elevenMinutesFromNow.toISOString());

    if (interviewsError) {
      console.error("Error fetching interviews:", interviewsError);
      throw interviewsError;
    }

    if (!upcomingInterviews || upcomingInterviews.length === 0) {
      console.log("No upcoming interviews found in the 10-minute window");
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0, message: "No interviews to remind" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${upcomingInterviews.length} interviews to send reminders for`);

    let remindersSent = 0;
    const errors: string[] = [];

    for (const interview of upcomingInterviews as Interview[]) {
      const jobTitle = interview.job_postings?.title || "intervju";
      const scheduledTime = new Date(interview.scheduled_at);
      const timeString = scheduledTime.toLocaleTimeString("sv-SE", { 
        hour: "2-digit", 
        minute: "2-digit",
        timeZone: "Europe/Stockholm"
      });

      // Prepare notification content
      const locationInfo = interview.location_type === "video" 
        ? "Videomöte" 
        : interview.location_type === "office"
        ? "På plats"
        : "Telefonintervju";

      // Send reminder to candidate (applicant)
      try {
        const candidateTitle = "Intervju om 10 minuter ⏰";
        const candidateBody = `Din intervju för "${jobTitle}" börjar kl ${timeString}. ${locationInfo}.`;

        const candidateResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            recipient_id: interview.applicant_id,
            title: candidateTitle,
            body: candidateBody,
            data: {
              type: "interview_reminder",
              interview_id: interview.id,
              route: "/my-applications",
            },
          }),
        });

        const candidateResult = await candidateResponse.json();
        if (candidateResult.success || candidateResult.sent >= 0) {
          console.log(`Reminder sent to candidate ${interview.applicant_id} for interview ${interview.id}`);
          remindersSent++;
        } else {
          console.log(`No tokens for candidate ${interview.applicant_id}: ${candidateResult.message || candidateResult.error}`);
        }
      } catch (err) {
        console.error(`Error sending reminder to candidate ${interview.applicant_id}:`, err);
        errors.push(`Candidate ${interview.applicant_id}: ${err.message}`);
      }

      // Send reminder to employer
      try {
        const employerTitle = "Intervju om 10 minuter ⏰";
        const employerBody = `Intervju för "${jobTitle}" börjar kl ${timeString}. ${locationInfo}.`;

        const employerResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            recipient_id: interview.employer_id,
            title: employerTitle,
            body: employerBody,
            data: {
              type: "interview_reminder",
              interview_id: interview.id,
              route: "/employer",
            },
          }),
        });

        const employerResult = await employerResponse.json();
        if (employerResult.success || employerResult.sent >= 0) {
          console.log(`Reminder sent to employer ${interview.employer_id} for interview ${interview.id}`);
          remindersSent++;
        } else {
          console.log(`No tokens for employer ${interview.employer_id}: ${employerResult.message || employerResult.error}`);
        }
      } catch (err) {
        console.error(`Error sending reminder to employer ${interview.employer_id}:`, err);
        errors.push(`Employer ${interview.employer_id}: ${err.message}`);
      }
    }

    console.log(`Interview reminders completed: ${remindersSent} reminders sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        interviews_processed: upcomingInterviews.length,
        reminders_sent: remindersSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Interview reminders error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
