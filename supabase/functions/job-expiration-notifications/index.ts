import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;


  console.log("Job expiration notification cron started");

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const now = new Date();
    const eightHoursFromNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    console.log(`Looking for jobs expiring between now and ${eightHoursFromNow.toISOString()}`);

    // Find active jobs expiring within 8 hours (for employer email notification)
    const { data: expiringJobs, error: jobsError } = await supabase
      .from("job_postings")
      .select(`
        id,
        title,
        expires_at,
        employer_id,
        profiles!job_postings_employer_id_fkey (
          email,
          first_name,
          company_name
        )
      `)
      .eq("is_active", true)
      .gt("expires_at", now.toISOString())
      .lte("expires_at", eightHoursFromNow.toISOString());

    if (jobsError) {
      console.error("Error fetching expiring jobs:", jobsError);
      throw jobsError;
    }

    console.log(`Found ${expiringJobs?.length || 0} jobs expiring within 8 hours`);

    // Send employer notification emails via Lovable Emails (hanterad e-postleverans)
    let emailsSent = 0;
    if (expiringJobs && expiringJobs.length > 0) {
      for (const job of expiringJobs) {
        const profile = job.profiles as any;
        const firstName = profile?.first_name || "Arbetsgivare";

        let email = profile?.email;
        if (!email) {
          const { data: authUser } = await supabase.auth.admin.getUserById(job.employer_id);
          email = authUser?.user?.email;
        }

        if (!email) {
          console.log('No email found for employer, skipping notification');
          continue;
        }

        const expiresDate = new Date(job.expires_at!);
        const hoursRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
        const timeText = hoursRemaining <= 1
          ? "mindre än en timme"
          : hoursRemaining < 24
            ? `${hoursRemaining} timmar`
            : `${Math.ceil(hoursRemaining / 24)} dag(ar)`;

        try {
          await sendLoggedTemplateEmail('job-expiration', email, {
            idempotencyKey: `job-expiration-${job.id}-${Math.floor(expiresDate.getTime() / (60 * 60 * 1000))}`,
            templateData: {
              first_name: firstName,
              job_title: job.title,
              time_text: timeText,
            },
          });
          emailsSent++;
          console.log('Sent job expiration email', { jobId: job.id });
        } catch (emailError) {
          console.error('Failed to send job expiration email', { jobId: job.id, error: emailError });
        }
      }
    }


    // Deactivate any jobs that have already expired
    const { data: expiredJobs, error: expireError } = await supabase
      .from("job_postings")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("expires_at", now.toISOString())
      .select("id, title");

    if (expireError) {
      console.error("Error deactivating expired jobs:", expireError);
    } else if (expiredJobs && expiredJobs.length > 0) {
      console.log(`Deactivated ${expiredJobs.length} expired jobs:`, expiredJobs.map(j => j.title));
    }

    // ─────────────────────────────────────────────────────────
    // AUTO-CLOSE: Send chat messages to candidates of closed jobs
    // ─────────────────────────────────────────────────────────
    let autoCloseMessagesSent = 0;

    // Find closed/expired jobs that haven't notified candidates yet
    const { data: closedJobs, error: closedError } = await supabase
      .from("job_postings")
      .select(`
        id,
        title,
        employer_id,
        profiles!job_postings_employer_id_fkey (
          company_name
        )
      `)
      .eq("is_active", false)
      .is("auto_close_notified_at", null)
      .limit(50); // Process in batches

    if (closedError) {
      console.error("Error fetching closed jobs for auto-close notifications:", closedError);
    } else if (closedJobs && closedJobs.length > 0) {
      console.log(`Found ${closedJobs.length} closed jobs needing candidate notifications`);

      for (const job of closedJobs) {
        const profile = job.profiles as any;
        const companyName = profile?.company_name || "Arbetsgivaren";

        // Find all candidates who applied and haven't been hired or rejected
        const { data: applicants, error: appError } = await supabase
          .from("job_applications")
          .select("id, applicant_id")
          .eq("job_id", job.id)
          .not("status", "in", '("hired","rejected")');

        if (appError) {
          console.error(`Error fetching applicants for job ${job.id}:`, appError);
          continue;
        }

        const uniqueApplicants = Array.from(
          new Map((applicants || []).map((app) => [app.applicant_id, app])).values()
        );

        if (uniqueApplicants.length === 0) {
          // No candidates to notify, mark as done
          await supabase
            .from("job_postings")
            .update({ auto_close_notified_at: now.toISOString() })
            .eq("id", job.id);
          continue;
        }

        console.log(`Sending auto-close messages to ${uniqueApplicants.length} candidates for "${job.title}"`);

        // Check if employer has a default message template
        let messageContent = `Hej! Tjänsten "${job.title}" hos ${companyName} har nu avslutats. Vi ser över alla kandidater som sökt och kontaktar dig om du blir aktuell för att gå vidare. Tack för ditt intresse och lycka till! 🙏`;

        const { data: defaultTemplate } = await supabase
          .from("employer_message_templates")
          .select("content")
          .eq("employer_id", job.employer_id)
          .eq("category", "rejection")
          .eq("is_default", true)
          .limit(1)
          .maybeSingle();

        if (defaultTemplate?.content) {
          messageContent = defaultTemplate.content.replace(/\{job_title\}/g, job.title);
        }

        for (const applicant of uniqueApplicants) {
          let conversationId: string | null = null;

          const { data: existingConversation, error: existingConversationError } = await supabase
            .from("conversations")
            .select("id")
            .eq("candidate_id", applicant.applicant_id)
            .not("candidate_id", "is", null)
            .maybeSingle();

          if (existingConversationError) {
            console.error(`Error finding conversation for candidate ${applicant.applicant_id}:`, existingConversationError);
            continue;
          }

          if (existingConversation?.id) {
            conversationId = existingConversation.id;
          } else {
            const { data: createdConversation, error: createConversationError } = await supabase
              .from("conversations")
              .insert({
                name: null,
                is_group: false,
                job_id: job.id,
                application_id: applicant.id,
                candidate_id: applicant.applicant_id,
                created_by: job.employer_id,
              })
              .select("id")
              .single();

            if (createConversationError || !createdConversation?.id) {
              console.error(`Error creating conversation for candidate ${applicant.applicant_id}:`, createConversationError);
              continue;
            }

            conversationId = createdConversation.id;
          }

          const { error: membersError } = await supabase
            .from("conversation_members")
            .upsert(
              [
                {
                  conversation_id: conversationId,
                  user_id: job.employer_id,
                  is_admin: true,
                },
                {
                  conversation_id: conversationId,
                  user_id: applicant.applicant_id,
                  is_admin: false,
                },
              ],
              { onConflict: "conversation_id,user_id" }
            );

          if (membersError) {
            console.error(`Error ensuring conversation members for ${conversationId}:`, membersError);
            continue;
          }

          const { error: msgError } = await supabase
            .from("conversation_messages")
            .insert({
              conversation_id: conversationId,
              sender_id: job.employer_id,
              content: messageContent,
            });

          if (msgError) {
            console.error(`Error sending auto-close message for conversation ${conversationId}:`, msgError);
            continue;
          }

          // Skapa in-app notis för kandidaten (triggar automatiskt push via DB-trigger)
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: applicant.applicant_id,
              type: "job_closed",
              title: "Jobbet är avslutat",
              body: `Tjänsten "${job.title}" hos ${companyName} har avslutats. Se meddelande i chatten.`,
              metadata: {
                job_id: job.id,
                application_id: applicant.id,
                route: "/my-applications",
              },
            });

          if (notifError) {
            console.error(`Error creating notification for ${applicant.applicant_id}:`, notifError);
          }

          // Mejl till kandidaten om att annonsen utgått (om användaren inte stängt av det)
          try {
            const { data: pref } = await supabase
              .from("notification_preferences")
              .select("email_enabled")
              .eq("user_id", applicant.applicant_id)
              .eq("notification_type", "job_closed")
              .maybeSingle();

            if (pref?.email_enabled !== false) {
              const { data: candidateProfile } = await supabase
                .from("profiles")
                .select("email, first_name")
                .eq("user_id", applicant.applicant_id)
                .maybeSingle();

              let candidateEmail = candidateProfile?.email as string | undefined;
              if (!candidateEmail) {
                const { data: authUser } = await supabase.auth.admin.getUserById(applicant.applicant_id);
                candidateEmail = authUser?.user?.email ?? undefined;
              }

              if (candidateEmail) {
                await sendLoggedTemplateEmail('job-closed-candidate', candidateEmail, {
                  idempotencyKey: `job-closed-candidate-${job.id}-${applicant.applicant_id}`,
                  templateData: {
                    first_name: candidateProfile?.first_name || 'där',
                    job_title: job.title,
                    company_name: companyName,
                  },
                });
              }
            }
          } catch (mailError) {
            console.error('Failed to send job-closed candidate email', { jobId: job.id, error: mailError });
          }

          autoCloseMessagesSent += 1;
        }


        // Mark job as notified
        await supabase
          .from("job_postings")
          .update({ auto_close_notified_at: now.toISOString() })
          .eq("id", job.id);

        console.log(`Auto-close messages sent for "${job.title}" to ${uniqueApplicants.length} candidates`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Job expiration notifications processed",
        jobsExpiringIn8Hours: expiringJobs?.length || 0,
        emailsSent,
        jobsDeactivated: expiredJobs?.length || 0,
        autoCloseMessagesSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in job-expiration-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
