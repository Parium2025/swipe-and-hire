import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InterviewInvitationRequest {
  candidateEmail: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  locationType: 'video' | 'office';
  locationDetails?: string;
  message?: string;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('sv-SE', options);
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
};

const getLocationTypeText = (locationType: string): string => {
  switch (locationType) {
    case 'video':
      return 'Videointervju';
    case 'office':
      return 'Intervju på plats';
    default:
      return 'Intervju';
  }
};

// Generate iCalendar format date string (UTC)
const formatIcsDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

// Generate unique ID for calendar event
const generateUid = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@parium.se`;
};

// Escape special characters for iCalendar text
const escapeIcsText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

// Generate .ics calendar file content
const generateIcsContent = (
  candidateName: string,
  companyName: string,
  jobTitle: string,
  scheduledAt: string,
  durationMinutes: number,
  locationType: string,
  locationDetails: string,
  message: string
): string => {
  const startDate = new Date(scheduledAt);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();
  
  const uid = generateUid();
  const summary = escapeIcsText(`Intervju: ${jobTitle} – ${companyName}`);
  const location = locationType === 'video' && locationDetails?.startsWith('http')
    ? escapeIcsText(locationDetails)
    : locationType === 'office' && locationDetails
    ? escapeIcsText(locationDetails)
    : escapeIcsText(getLocationTypeText(locationType));
  
  let description = escapeIcsText(`Intervju för tjänsten ${jobTitle} hos ${companyName}.`);
  if (locationType === 'video' && locationDetails?.startsWith('http')) {
    description += escapeIcsText(`\n\nMöteslänk: ${locationDetails}`);
  }
  if (message) {
    description += escapeIcsText(`\n\nMeddelande från arbetsgivaren:\n${message}`);
  }
  
  // iCalendar format (RFC 5545)
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Parium//Interview Invitation//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `ORGANIZER;CN=${escapeIcsText(companyName)}:mailto:noreply@parium.se`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeIcsText(candidateName)}:mailto:${candidateName}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    // Add reminder 1 hour before
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Påminnelse: Intervju om 1 timme',
    'END:VALARM',
    // Add reminder 10 minutes before
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Påminnelse: Intervju om 10 minuter',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return icsContent;
};

const getInterviewTemplate = (
  candidateName: string,
  companyName: string,
  jobTitle: string,
  scheduledAt: string,
  durationMinutes: number,
  locationType: string,
  locationDetails: string,
  message: string
) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Intervjukallelse – ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: bold; color: #ffffff;">🎉 Du är kallad till intervju!</h1>
              <p style="margin: 0; font-size: 16px; color: rgba(255,255,255,0.9);">${companyName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 24px 0; font-size: 18px; color: #111827; line-height: 1.6;">
                Hej ${candidateName}!
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Vi vill gärna träffa dig för en intervju gällande tjänsten <strong>${jobTitle}</strong>.
              </p>
              
              <!-- Calendar notification -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ECFDF5; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px;">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <span style="font-size: 20px;">📆</span>
                        </td>
                        <td style="vertical-align: middle;">
                          <p style="margin: 0; font-size: 14px; color: #065F46; font-weight: 500;">
                            En kalenderhändelse har bifogats till detta mejl.<br>
                            Öppna den för att lägga till intervjun i din kalender.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Interview Details Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F0F9FF; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 24px;">📅</span>
                              </td>
                              <td style="vertical-align: middle;">
                                <p style="margin: 0; font-size: 14px; color: #6B7280; font-weight: 500;">DATUM</p>
                                <p style="margin: 4px 0 0 0; font-size: 16px; color: #111827; font-weight: 600;">${formatDate(scheduledAt)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 24px;">🕐</span>
                              </td>
                              <td style="vertical-align: middle;">
                                <p style="margin: 0; font-size: 14px; color: #6B7280; font-weight: 500;">TID</p>
                                <p style="margin: 4px 0 0 0; font-size: 16px; color: #111827; font-weight: 600;">${formatTime(scheduledAt)} (${durationMinutes} min)</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 24px;">${locationType === 'video' ? '💻' : '🏢'}</span>
                              </td>
                              <td style="vertical-align: middle;">
                                <p style="margin: 0; font-size: 14px; color: #6B7280; font-weight: 500;">${getLocationTypeText(locationType).toUpperCase()}</p>
                                <p style="margin: 4px 0 0 0; font-size: 16px; color: #111827; font-weight: 600; word-break: break-word;">${locationDetails || 'Information kommer'}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${message ? `
              <!-- Message from employer -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px; background-color: #F9FAFB; border-left: 4px solid #3B82F6; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6B7280; font-weight: 500;">Meddelande från ${companyName}:</p>
                    <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6; white-space: pre-line;">${message}</p>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              ${locationType === 'video' && locationDetails && locationDetails.startsWith('http') ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${locationDetails}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; line-height: 52px; text-align: center; text-decoration: none; width: 280px;">
                      Anslut till videomötet
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="margin: 24px 0 0 0; font-size: 15px; color: #374151; text-align: center; line-height: 1.6;">
                Vi ser fram emot att träffa dig!<br>
                <strong>Teamet på ${companyName}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 14px; color: #6B7280;">
                Detta mail skickades via Parium<br>
                <a href="https://parium.se" style="color: #3B82F6; text-decoration: none;">parium.se</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      candidateEmail,
      candidateName,
      companyName,
      jobTitle,
      scheduledAt,
      durationMinutes,
      locationType,
      locationDetails,
      message,
    }: InterviewInvitationRequest = await req.json();

    console.log(`Sending interview invitation to ${candidateEmail} for ${jobTitle} at ${companyName}`);

    const emailHtml = getInterviewTemplate(
      candidateName,
      companyName,
      jobTitle,
      scheduledAt,
      durationMinutes,
      locationType,
      locationDetails || '',
      message || ''
    );

    // Generate iCalendar content for automatic calendar addition
    const icsContent = generateIcsContent(
      candidateName,
      companyName,
      jobTitle,
      scheduledAt,
      durationMinutes,
      locationType,
      locationDetails || '',
      message || ''
    );
    
    // Convert .ics content to base64 for email attachment
    const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));

    console.log(`Generated ICS calendar event for interview at ${scheduledAt}`);

    const emailResponse = await resend.emails.send({
      from: `${companyName} via Parium <noreply@parium.se>`,
      to: [candidateEmail],
      subject: `Intervjukallelse: ${jobTitle} – ${companyName}`,
      html: emailHtml,
      attachments: [
        {
          filename: 'intervju.ics',
          content: icsBase64,
          content_type: 'text/calendar; method=REQUEST',
        }
      ],
    });

    console.log("Interview invitation email with calendar attachment sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-interview-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
