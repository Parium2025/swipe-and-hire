import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MailCheck, MessageSquareText, Route } from 'lucide-react';
import { AutoMessagesPanel } from '@/components/employer/outreach/AutoMessagesPanel';
import { MessageTemplatesSettings } from '@/components/MessageTemplatesSettings';

const systemMessages = [
  'Intervjukallelse med svar och kalenderlänk',
  'Påminnelse till arbetsgivaren efter 14 dagar',
  'Påminnelser om sparade jobb och jobb som går ut',
  'Konto-, säkerhets- och supportmeddelanden',
];

export function OutreachSettingsHub() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Utskick</h3>
        <p className="text-sm text-white">Automatiska flöden, manuella besked och fasta systemmeddelanden hålls åtskilda.</p>
      </div>

      <Accordion type="single" collapsible defaultValue="automatic" className="space-y-3">
        <AccordionItem value="automatic" className="rounded-lg border border-white/15 bg-white/5 px-4">
          <AccordionTrigger className="gap-3 py-4 text-left text-white hover:no-underline">
            <span className="flex min-w-0 items-center gap-2"><Route className="h-4 w-4 shrink-0" /><span className="truncate">Automatiska flöden</span></span>
          </AccordionTrigger>
          <AccordionContent className="pb-4"><AutoMessagesPanel /></AccordionContent>
        </AccordionItem>

        <AccordionItem value="manual" className="rounded-lg border border-white/15 bg-white/5 px-4">
          <AccordionTrigger className="gap-3 py-4 text-left text-white hover:no-underline">
            <span className="flex min-w-0 items-center gap-2"><MessageSquareText className="h-4 w-4 shrink-0" /><span className="truncate">Manuella besked och mallar</span></span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <p className="text-sm text-white">Gå vidare och Ge avslag väljs från kandidatprofilen. Text och kanaler granskas alltid innan något skickas.</p>
            <MessageTemplatesSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="system" className="rounded-lg border border-white/15 bg-white/5 px-4">
          <AccordionTrigger className="gap-3 py-4 text-left text-white hover:no-underline">
            <span className="flex min-w-0 items-center gap-2"><MailCheck className="h-4 w-4 shrink-0" /><span className="truncate">Systemutskick</span></span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <p className="mb-3 text-sm text-white">Dessa är låsta och hanteras av Parium utanför mallbiblioteket.</p>
            <ul className="space-y-2">
              {systemMessages.map((message) => <li key={message} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">{message}</li>)}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}