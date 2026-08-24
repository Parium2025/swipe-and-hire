import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  sendTemplateEmail,
  type SendTemplateEmailOptions,
  type SendTemplateEmailResult,
} from './send-email.ts'

/**
 * Skickar ett registrerat mejl via Lovables e-posttjänst och skriver samma
 * revisionsrad i `email_send_log` som tidigare sändningsväg gjorde
 * ('sent' / 'suppressed' / 'failed'). Loggraden avgör aldrig utfallet —
 * ett misslyckat loggskrivande loggas bara i konsolen.
 */
export async function sendLoggedTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabase =
    supabaseUrl && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null

  const writeLog = async (
    status: 'sent' | 'suppressed' | 'failed',
    errorMessage?: string,
  ) => {
    if (!supabase) return
    const { error } = await supabase.from('email_send_log').insert({
      template_name: templateName,
      recipient_email: to,
      status,
      error_message: errorMessage ?? null,
    })
    if (error) {
      console.error('email_send_log insert failed', {
        code: error.code,
        message: error.message,
        template_name: templateName,
        status,
      })
    }
  }

  try {
    const result = await sendTemplateEmail(templateName, to, options)
    await writeLog(result.sent ? 'sent' : 'suppressed')
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await writeLog('failed', message.slice(0, 1000))
    throw error
  }
}
