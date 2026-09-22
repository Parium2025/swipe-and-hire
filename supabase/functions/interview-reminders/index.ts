import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRoleOrCronSecret } from "../_shared/service-auth.ts";
import { sendInterviewRescheduleEmail } from "../_shared/interviewRescheduleEmail.ts";
import { googleDefaultReminderCollides } from "../_shared/calendarSync.ts";

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

interface InterviewTimelineAutomation {
  id: string;
  owner_user_id: string;
  organization_id: string | null;
  channel: "chat" | "email" | "push";
  template_id: string;
  trigger: "interview_before" | "interview_after";
  delay_minutes: number;
  filters: Record<string, unknown> | null;
}

const WINDOW_PADDING_MS = 150 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders);
  if (authResp) return authResp;

  // Realtidsgren: databastriggern anropar den här funktionen i samma ögonblick
  // som en intervjutid ändras (i appen eller i arbetsgivarens kalender) och
  // kandidaten får då direkt ett "ny tid"-mejl med ja/nej-knappar.
  // Grenen rör inte den vanliga minutkörningen nedan.
  let requestBody:
    | { reschedule_interview_id?: string; old_scheduled_at?: string | null; worker_page?: number }
    | null = null;
  try {
    const cloned = req.clone();
    requestBody = await cloned.json().catch(() => null);
    if (requestBody?.reschedule_interview_id) {
      const result = await sendInterviewRescheduleEmail(
        requestBody.reschedule_interview_id,
        requestBody.old_scheduled_at ?? null,
      );
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (rescheduleError) {
    console.error("Ny tid-mejl misslyckades", rescheduleError);
    return new Response(JSON.stringify({ error: "reschedule_email_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Sharding: minutkörningen (sida 0) är koordinator. Ligger fler möten i
  // fönstret än en sida rymmer startar den parallella arbetare som tar sida
  // 1, 2, 3 … samtidigt. Då begränsas kapaciteten inte av en enda körning.
  const workerPage = Math.max(0, Math.min(Number(requestBody?.worker_page ?? 0) || 0, 15));
  const PAGE_SIZE = 500;
  const MAX_WORKERS = 16;


  console.log("Interview reminders cron job started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Single-flight per sida: samma sida får aldrig köras två gånger samtidigt,
    // men olika sidor (arbetare) kör parallellt och delar upp arbetet.
    const lockKey = workerPage === 0 ? 'interview-reminders' : `interview-reminders-w${workerPage}`;
    const { data: gotLock } = await supabase.rpc('try_claim_job_lock', {
      _key: lockKey,
      _ttl_seconds: 55,
    });
    if (gotLock !== true) {
      console.log(`Another interview-reminders run is in progress (${lockKey}) — skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'run_in_progress' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();

    // Hur många möten som behandlas samtidigt. Arbetet är nästan bara väntan på
    // nätverk, så bredden – inte processorn – avgör hur många som hinner med.
    const REMINDER_CONCURRENCY = 120;
    const FOLLOWUP_CONCURRENCY = 120;

    // Tidsbudget: körningen avslutas snyggt efter 50 sekunder så att nästa
    // minutkörning tar vid, i stället för att avbrytas mitt i av plattformen.
    const RUN_DEADLINE = Date.now() + 50_000;
    const outOfTime = () => Date.now() > RUN_DEADLINE;

    // Symbios med Google Kalender: om mottagarens eget Google-larm ligger på
    // exakt samma antal minuter före intervjun som Pariums utskick hoppar vi
    // över vårt – annars pinglas personen två gånger samma minut. Kollen är
    // live (en ändring i Google slår igenom direkt) och fail-open: kan vi inte
    // läsa Googles inställning skickar Parium alltid som vanligt.
    // Resultatet cachas per körning så samma användare inte slås upp flera
    // gånger i samma minutsvep.
    const collisionCache = new Map<string, boolean>();
    const collidesWithGoogleReminder = async (userId: string, leadMinutes: number): Promise<boolean> => {
      const key = `${userId}:${leadMinutes}`;
      const cached = collisionCache.get(key);
      if (cached !== undefined) return cached;
      const collides = await googleDefaultReminderCollides(userId, leadMinutes);
      collisionCache.set(key, collides);
      return collides;
    };

    const queueInterviewTimelineDispatches = async (trigger: "interview_before" | "interview_after") => {
      const { data: automations, error: automationsError } = await supabase
        .from("outreach_automations")
        .select("id, owner_user_id, organization_id, channel, template_id, trigger, delay_minutes, filters")
        .eq("trigger", trigger)
        .eq("recipient_type", "candidate")
        .eq("is_enabled", true);

      if (automationsError) {
        console.error(`Error fetching ${trigger} automations:`, automationsError);
        return 0;
      }

      let queued = 0;

      // En avaktiverad mall får inte skicka något – samma regel som vid ombokning.
      const templateIds = [...new Set(((automations || []) as InterviewTimelineAutomation[])
        .map((a) => (a as { template_id?: string | null }).template_id)
        .filter(Boolean))] as string[];
      const activeTemplateIds = new Set<string>();
      if (templateIds.length > 0) {
        const { data: templates } = await supabase
          .from("outreach_templates")
          .select("id")
          .in("id", templateIds)
          .eq("is_active", true);
        for (const t of templates || []) activeTemplateIds.add((t as { id: string }).id);
      }

      // Arbetsgivaren äger OM och NÄR påminnelsen går ut (regel + mall).
      // Kandidaten äger PÅ VILKEN KANAL den landar. Därför slår vi ihop
      // arbetsgivarens regler per tidpunkt och skickar sedan på de kanaler
      // kandidaten själv valt (chatt ligger alltid kvar i inkorgen).
      type Group = {
        rep: InterviewTimelineAutomation;
        byChannel: Map<string, InterviewTimelineAutomation>;
      };
      const groups = new Map<string, Group>();
      for (const automation of (automations || []) as InterviewTimelineAutomation[]) {
        const tplId = (automation as { template_id?: string | null }).template_id;
        if (tplId && !activeTemplateIds.has(tplId)) continue;
        const delay = Math.max(automation.delay_minutes ?? 0, 0);
        const key = `${automation.owner_user_id}:${delay}`;
        const group = groups.get(key);
        if (!group) {
          groups.set(key, { rep: automation, byChannel: new Map([[automation.channel, automation]]) });
          continue;
        }
        if (!group.byChannel.has(automation.channel)) group.byChannel.set(automation.channel, automation);
        // Chattregelns mall är den rikaste – låt den vara reserv för övriga kanaler.
        if (group.rep.channel !== "chat" && automation.channel === "chat") group.rep = automation;
      }

      const candidateChannelCache = new Map<string, string[]>();
      const candidateChannels = async (userId: string): Promise<string[]> => {
        const cached = candidateChannelCache.get(userId);
        if (cached) return cached;
        const { data } = await supabase
          .from("notification_preferences")
          .select("is_enabled, email_enabled")
          .eq("user_id", userId)
          .eq("notification_type", "interview_scheduled")
          .maybeSingle();
        // Chatten kan inte stängas av – kallelsen ska alltid finnas i tråden.
        const channels = ["chat"];
        if (!data || data.is_enabled !== false) channels.push("push");
        if (!data || data.email_enabled !== false) channels.push("email");
        candidateChannelCache.set(userId, channels);
        return channels;
      };

      for (const { rep, byChannel } of groups.values()) {
        const automation = rep;
        const delayMs = Math.max(automation.delay_minutes ?? 0, 0) * 60 * 1000;
        const targetTime = trigger === "interview_before"
          ? new Date(now.getTime() + delayMs)
          : new Date(now.getTime() - delayMs);

        const rangeStart = new Date(targetTime.getTime() - WINDOW_PADDING_MS).toISOString();
        const rangeEnd = new Date(targetTime.getTime() + WINDOW_PADDING_MS).toISOString();

        // Före intervjun räcker pending/confirmed. Efteråt krävs ett faktiskt
        // svar: tack-mejlet ska aldrig gå till en intervju kandidaten tackat
        // nej till (declined), som avbokats, eller som hen aldrig svarat på
        // (pending). Vi kan inte veta om någon dök upp, men ett bekräftat
        // möte är den bästa proxy:n.
        const interviewStatuses = trigger === "interview_before" ? ["pending", "confirmed"] : ["confirmed", "completed"];

        const { data: interviews, error: interviewsError } = await supabase
          .from("interviews")
          .select("id, applicant_id, employer_id, job_id, scheduled_at, location_type, location_details, revision")
          .eq("employer_id", automation.owner_user_id)
          .in("status", interviewStatuses)
          .gte("scheduled_at", rangeStart)
          .lte("scheduled_at", rangeEnd);

        if (interviewsError) {
          console.error(`Error fetching interviews for ${trigger}:`, interviewsError);
          continue;
        }

        // En enda logguppslagning för hela gruppen i stället för en per möte –
        // med hundratals möten samtidigt är det skillnaden mellan sekunder
        // och minuter.
        const interviewIds = (interviews || []).map((i) => (i as { id: string }).id);
        const logsByInterview = new Map<string, Array<{ channel: string; payload: Record<string, unknown> | null; recipient: string }>>();
        if (interviewIds.length > 0) {
          const CHUNK = 200;
          for (let i = 0; i < interviewIds.length; i += CHUNK) {
            const { data: logs } = await supabase
              .from("outreach_dispatch_logs")
              .select("interview_id, channel, payload, recipient_user_id")
              .in("interview_id", interviewIds.slice(i, i + CHUNK))
              .eq("trigger", trigger);
            for (const log of logs || []) {
              const row = log as { interview_id: string; channel: string; payload: Record<string, unknown> | null; recipient_user_id: string };
              const list = logsByInterview.get(row.interview_id) ?? [];
              list.push({ channel: row.channel, payload: row.payload, recipient: row.recipient_user_id });
              logsByInterview.set(row.interview_id, list);
            }
          }
        }

        for (const interview of interviews || []) {
          // Revisionen gör att en ombokad intervju får en ny påminnelse –
          // utan den blockerar den redan skickade loggen alltid nya tider.
          const revision = (interview as { revision?: number }).revision ?? 0;

          const existingLogs = logsByInterview.get(interview.id) ?? [];

          const alreadyQueuedChannels = new Set(
            existingLogs
              .filter((log) => {
                if (log.recipient !== interview.applicant_id) return false;
                const payload = log.payload;
                const loggedRevision = Number(payload?.revision ?? 0);
                const loggedDelay = Number(payload?.delay_minutes ?? -1);
                return loggedRevision === revision
                  && loggedDelay === Math.max(automation.delay_minutes ?? 0, 0);
              })
              .map((log) => log.channel),
          );


          // Före-intervju: kandidatens eget Google-larm på samma minutantal
          // ersätter vårt LARM (push) – men chatt/mejl finns kvar, annars
          // försvinner själva meddelandet ur tråden.
          const googleCollides = trigger === "interview_before"
            && await collidesWithGoogleReminder(
              interview.applicant_id,
              Math.max(automation.delay_minutes ?? 0, 0),
            );
          if (googleCollides) {
            console.log(
              `interview_before push skipped – Google påminner redan ${automation.delay_minutes} min före (kandidat ${interview.applicant_id})`,
            );
          }

          const channels = (await candidateChannels(interview.applicant_id))
            .filter((channel) => !(googleCollides && channel === "push"));

          for (const channel of channels) {
            if (alreadyQueuedChannels.has(channel)) continue;
            const source = byChannel.get(channel) ?? automation;

            const { error: insertError } = await supabase.from("outreach_dispatch_logs").insert({
              owner_user_id: automation.owner_user_id,
              organization_id: automation.organization_id,
              automation_id: source.id,
              template_id: source.template_id,
              trigger,
              channel,
              recipient_user_id: interview.applicant_id,
              interview_id: interview.id,
              job_id: interview.job_id,
              payload: {
                source: "interview-reminders",
                queued_at: now.toISOString(),
                revision,
                delay_minutes: automation.delay_minutes,
                filters: automation.filters,
                location_type: interview.location_type,
                location_details: interview.location_details,
                channel_chosen_by: "recipient",
              },
              status: "pending",
            });

            if (!insertError) queued += 1;
          }
        }
      }

      if (queued > 0) {
        await fetch(`${supabaseUrl}/functions/v1/outreach-dispatch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ trigger }),
        });
      }

      return queued;
    };

    // ─────────────────────────────────────────────────────────
    // PART 1: 10-minute pre-interview reminders (existing)
    // ─────────────────────────────────────────────────────────
    const elevenMinutesFromNow = new Date(now.getTime() + 11 * 60 * 1000);

    console.log(`Looking for confirmed interviews between ${now.toISOString()} and ${elevenMinutesFromNow.toISOString()}`);

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
      // En bokad intervju gäller tills den avbokas eller tackas nej till.
      // Kandidaten bekräftar sällan i appen – därför räknas även "pending".
      .in("status", ["pending", "confirmed"])
      // Undre gränsen är "nu", inte "nu + 9 min": om fler än 200 möten ligger
      // i samma fönster tas resten i nästa körning, och då har fönstret redan
      // glidit förbi dem. Med "nu" som golv hinner överskottet alltid med –
      // i värsta fall några minuter senare i stället för aldrig.
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", elevenMinutesFromNow.toISOString())
      // Fönstret är brett men cron kör varje minut – utan denna
      // markering skulle samma påminnelse skickas två gånger.
      .is("reminder_sent_at", null)
      // Stabil ordning + sidindelning: varje arbetare tar sin egen sida, så
      // tiotusentals möten kan behandlas parallellt inom samma minut.
      .order("scheduled_at", { ascending: true })
      .order("id", { ascending: true })
      .range(workerPage * PAGE_SIZE, workerPage * PAGE_SIZE + PAGE_SIZE - 1);

    if (interviewsError) {
      console.error("Error fetching interviews:", interviewsError);
      throw interviewsError;
    }

    // Full sida = det finns troligen mer. Koordinatorn startar då extra
    // arbetare som tar nästa sidor samtidigt i stället för nästa minut.
    if (workerPage === 0 && (upcomingInterviews?.length ?? 0) >= PAGE_SIZE) {
      const { count } = await supabase
        .from("interviews")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "confirmed"])
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", elevenMinutesFromNow.toISOString())
        .is("reminder_sent_at", null);
      const pagesNeeded = Math.min(Math.ceil((count ?? PAGE_SIZE) / PAGE_SIZE), MAX_WORKERS);
      for (let page = 1; page < pagesNeeded; page++) {
        const call = fetch(`${supabaseUrl}/functions/v1/interview-reminders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ worker_page: page }),
        }).catch((err) => console.error(`worker ${page} failed to start`, err));
        // Starta arbetaren utan att vänta – koordinatorn kör sin egen sida.
        (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
          .EdgeRuntime?.waitUntil(call);
      }
      console.log(`Fan-out: ${pagesNeeded} sidor (~${count} möten) behandlas parallellt`);
    }



    let remindersSent = 0;
    const errors: string[] = [];

    // Arbetsgivaren äger besluten: har de stängt av "Före intervjun" helt
    // skickas ingenting till kandidaten – inte heller 10-minutersputten.
    // Ligger deras egen regel nära 10 minuter (5–20 min) hoppas 10-minuters-
    // putten också över, annars får kandidaten två påminnelser samtidigt.
    const employerAllowsCandidateReminder = new Map<string, boolean>();
    const candidateRemindersAllowed = async (employerId: string) => {
      if (employerAllowsCandidateReminder.has(employerId)) {
        return employerAllowsCandidateReminder.get(employerId)!;
      }
      const { data } = await supabase
        .from("outreach_automations")
        .select("id, delay_minutes")
        .eq("owner_user_id", employerId)
        .eq("trigger", "interview_before")
        .eq("recipient_type", "candidate")
        .eq("is_enabled", true);
      const rules = (data ?? []) as Array<{ delay_minutes: number | null }>;
      const collides = rules.some((rule) => {
        const delay = rule.delay_minutes ?? 0;
        return delay >= 5 && delay <= 20;
      });
      const allowed = rules.length > 0 && !collides;
      employerAllowsCandidateReminder.set(employerId, allowed);
      return allowed;
    };


    if (upcomingInterviews && upcomingInterviews.length > 0) {
      console.log(`Found ${upcomingInterviews.length} interviews to send reminders for`);

      // SKALA: varje intervju kräver ~6 anrop i följd. Med 200 möten i samma
      // minutsvep hann körningen inte klart innan cron startade nästa. Nu körs
      // åtta möten samtidigt – samma claim-skydd, samma ordning per möte, men
      // hela svepet blir klart i tid även vid hög belastning.
      const processInterview = async (interview: Interview) => {
        // Claim direkt: en samtidig körning får aldrig skicka samma påminnelse.
        const { data: claimed } = await supabase
          .from("interviews")
          .update({ reminder_sent_at: now.toISOString() })
          .eq("id", interview.id)
          .is("reminder_sent_at", null)
          .select("id")
          .maybeSingle();
        if (!claimed) return;

        const jobTitle = interview.job_postings?.title || "intervju";
        const scheduledTime = new Date(interview.scheduled_at);
        // Alltid utmärkt som svensk tid – mottagaren kan sitta i en annan tidszon.
        const timeString = `${scheduledTime.toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Stockholm",
        })}`;

        // Rubriken speglar den faktiska tiden kvar. Skickas kallelsen nio
        // minuter före start ska notisen säga nio – inte tio.
        const minutesLeft = Math.round(
          (scheduledTime.getTime() - Date.now()) / 60000,
        );
        const reminderHeadline = minutesLeft <= 1
          ? "Intervjun börjar nu ⏰"
          : `Intervju om ${minutesLeft} minuter ⏰`;

        const locationInfo = interview.location_type === "video"
          ? "Videomöte"
          : interview.location_type === "office"
          ? "På plats"
          : "Telefonintervju";

        // Notis i appen + push. Push kräver mobilappen – notisen i appen är
        // det enda som når webbanvändare, därför skapas den alltid först.
        const notifyBoth = async (
          userId: string,
          title: string,
          body: string,
          route: string,
          options?: { skipPush?: boolean },
        ) => {
          let delivered = false;
          const { error: notifError } = await supabase.from("notifications").insert({
            user_id: userId,
            type: "interview_reminder",
            title,
            body,
            metadata: { interview_id: interview.id, route },
          });
          if (notifError) {
            console.error(`Failed to create in-app reminder for ${userId}:`, notifError);
            errors.push(`Notification ${userId}: ${notifError.message}`);
          } else {
            delivered = true;
          }

          if (!options?.skipPush) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  recipient_id: userId,
                  title,
                  body,
                  data: {
                    type: "interview_reminder",
                    interview_id: interview.id,
                    route,
                  },
                }),
              });
            } catch (err) {
              // Push är ett komplement – saknad mobilapp får inte fälla påminnelsen.
              console.error(`Push failed for ${userId}:`, err);
            }
          }

          if (delivered) {
            console.log(`Reminder delivered to ${userId}`);
            remindersSent++;
          }
        };

        // Kandidaten påminns bara om arbetsgivaren har "Före intervjun" på.
        // Ligger kandidatens eget Google-larm på exakt 10 minuter hoppar vi
        // över vårt LARM (push) men behåller notisen i appen.
        const candidateReminderAllowed = await candidateRemindersAllowed(interview.employer_id);
        const candidateGoogleCollides = candidateReminderAllowed
          ? await collidesWithGoogleReminder(interview.applicant_id, 10)
          : false;
        if (candidateReminderAllowed) {
          if (candidateGoogleCollides) {
            console.log(`Candidate push skipped – Google påminner redan 10 min före (kandidat ${interview.applicant_id})`);
          }
          await notifyBoth(
            interview.applicant_id,
            "Intervju om 10 minuter ⏰",
            `Din intervju för "${jobTitle}" börjar kl ${timeString}. ${locationInfo}.`,
            "/my-applications",
            { skipPush: candidateGoogleCollides },
          );
        } else {
          console.log(`Candidate reminder skipped – employer ${interview.employer_id} has interview_before off`);
        }

        // Arbetsgivaren påminns alltid om sin egen bokning – med samma
        // undantag: hennes eget Google-larm på exakt 10 minuter ersätter pushen.
        const employerGoogleCollides = await collidesWithGoogleReminder(interview.employer_id, 10);
        if (employerGoogleCollides) {
          console.log(`Employer push skipped – Google påminner redan 10 min före (arbetsgivare ${interview.employer_id})`);
        }
        await notifyBoth(
          interview.employer_id,
          "Intervju om 10 minuter ⏰",
          `Intervju för "${jobTitle}" börjar kl ${timeString}. ${locationInfo}.`,
          "/employer",
          { skipPush: employerGoogleCollides },
        );

      };
      // 40 möten samtidigt: varje möte är mest väntan på nätverk, så bredden
      // avgör hur många som hinner med per minut. 300 möten i samma minut tar
      // nu sekunder i stället för minuter. Tidsbudgeten nedan ser till att
      // körningen alltid avslutas snyggt – resten tas av nästa minutkörning,
      // och eftersom golvet är "nu" tappas ingen påminnelse.
      const interviewList = upcomingInterviews as unknown as Interview[];
      for (let i = 0; i < interviewList.length; i += REMINDER_CONCURRENCY) {
        if (outOfTime()) {
          console.log(`Time budget reached – ${interviewList.length - i} reminders deferred to next run`);
          break;
        }
        await Promise.all(interviewList.slice(i, i + REMINDER_CONCURRENCY).map(processInterview));
      }
    } else {
      console.log("No upcoming interviews found in the 10-minute window");
    }

    // ─────────────────────────────────────────────────────────
    // PART 2: Post-interview follow-up reminders (NEW)
    // Reminds recruiters 3 days after an interview if they
    // haven't taken action (changed candidate status).
    // ─────────────────────────────────────────────────────────
    let followupRemindersSent = 0;

    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    // Find interviews that happened 3-4 days ago, are confirmed, 
    // and haven't had a follow-up reminder sent yet
    const { data: pastInterviews, error: pastError } = await supabase
      .from("interviews")
      .select(`
        id,
        applicant_id,
        employer_id,
        job_id,
        job_postings(title)
      `)
      // Samma regel som ovan: en obekräftad men genomförd intervju ska också
      // ge rekryteraren en påminnelse om att lämna besked.
      .in("status", ["pending", "confirmed", "completed"])
      .gte("scheduled_at", fourDaysAgo.toISOString())
      .lte("scheduled_at", threeDaysAgo.toISOString())
      .is("followup_reminder_sent_at", null)
      // Samma sidindelning som ovan – arbetarna delar upp uppföljningarna.
      .order("scheduled_at", { ascending: true })
      .order("id", { ascending: true })
      .range(workerPage * PAGE_SIZE, workerPage * PAGE_SIZE + PAGE_SIZE - 1);


    if (pastError) {
      console.error("Error fetching past interviews for follow-up:", pastError);
    } else if (pastInterviews && pastInterviews.length > 0) {
      console.log(`Found ${pastInterviews.length} interviews needing follow-up reminders`);

      // Samma skäl som 10-minutersvepet: åtta uppföljningar i taget i stället
      // för en i taget, så 200 möten hinner klart inom körningens tidsfönster.
      const processFollowup = async (interview: any) => {
        const jobTitle = (interview.job_postings as any)?.title || "tjänsten";

        // Claim först: samtidiga körningar får aldrig skicka dubbla påminnelser.
        const { data: claimedFollowup } = await supabase
          .from("interviews")
          .update({ followup_reminder_sent_at: now.toISOString() })
          .eq("id", interview.id)
          .is("followup_reminder_sent_at", null)
          .select("id")
          .maybeSingle();
        if (!claimedFollowup) return;

        // Check if the recruiter has already taken action on this candidate
        // (changed status from pending/reviewed, or added to my_candidates with stage change)
        // maybeSingle: intervjun kan sakna koppling till en ansökan (manuellt tillagd kandidat).
        const { data: application } = interview.job_id
          ? await supabase
              .from("job_applications")
              .select("status")
              .eq("job_id", interview.job_id)
              .eq("applicant_id", interview.applicant_id)
              .limit(1)
              .maybeSingle()
          : { data: null };

        // If the candidate is still in "interview" status, the recruiter hasn't acted
        const needsReminder = application?.status === "interview" || application?.status === "pending" || application?.status === "reviewed";

        if (needsReminder) {
          // Get candidate name for the reminder
          const { data: candidateProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", interview.applicant_id)
            .maybeSingle();


          const candidateName = candidateProfile
            ? `${candidateProfile.first_name || ""} ${candidateProfile.last_name || ""}`.trim()
            : "kandidaten";

          const followupTitle = "Dags att ge återkoppling 💬";
          const followupBody = `Det har gått 3 dagar sedan intervjun med ${candidateName} för "${jobTitle}". Ge kandidaten besked!`;

          // Notis i appen först – push är ett komplement för mobilappen.
          const { error: followupNotifError } = await supabase.from("notifications").insert({
            user_id: interview.employer_id,
            type: "followup_reminder",
            title: followupTitle,
            body: followupBody,
            metadata: {
              interview_id: interview.id,
              applicant_id: interview.applicant_id,
              route: "/employer",
            },
          });

          if (followupNotifError) {
            console.error(`Error creating follow-up notification for interview ${interview.id}:`, followupNotifError);
            errors.push(`Followup ${interview.id}: ${followupNotifError.message}`);
          } else {
            followupRemindersSent++;
            console.log(`Follow-up reminder sent to employer ${interview.employer_id} for candidate ${candidateName}`);
          }

          try {
            await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                recipient_id: interview.employer_id,
                title: followupTitle,
                body: followupBody,
                data: {
                  type: "followup_reminder",
                  interview_id: interview.id,
                  applicant_id: interview.applicant_id,
                  route: "/employer",
                },
              }),
            });
          } catch (err) {
            console.error(`Push failed for follow-up ${interview.id}:`, err);
          }
        }
      };
      for (let i = 0; i < pastInterviews.length; i += FOLLOWUP_CONCURRENCY) {
        if (outOfTime()) {
          console.log(`Time budget reached – ${pastInterviews.length - i} follow-ups deferred to next run`);
          break;
        }
        await Promise.all(pastInterviews.slice(i, i + FOLLOWUP_CONCURRENCY).map(processFollowup));
      }
    }

    // Arbetsgivarens egna regler köas bara av koordinatorn – arbetarna skulle
    // annars göra exakt samma genomgång en gång till.
    const beforeInterviewQueued = workerPage === 0
      ? await queueInterviewTimelineDispatches("interview_before")
      : 0;
    const afterInterviewQueued = workerPage === 0
      ? await queueInterviewTimelineDispatches("interview_after")
      : 0;

    console.log(`Interview reminders completed (page ${workerPage}): ${remindersSent} pre-reminders, ${followupRemindersSent} follow-up reminders, ${beforeInterviewQueued} queued before-interview messages, ${afterInterviewQueued} queued after-interview messages`);

    await supabase.rpc('release_job_lock', { _key: lockKey });

    return new Response(
      JSON.stringify({
        success: true,
        interviews_processed: upcomingInterviews?.length || 0,
        reminders_sent: remindersSent,
        followup_reminders_sent: followupRemindersSent,
        outreach_before_queued: beforeInterviewQueued,
        outreach_after_queued: afterInterviewQueued,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Interview reminders error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
