import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import { CalendarDays, Video, MapPin, MessageSquare, HelpCircle, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InterviewTypeTabs, type InterviewType } from './InterviewTypeTabs';
import { isValidMeetingLink } from './meetingLinkValidation';
import type { CompanyFormData } from './types';

interface CompanyInterviewSettingsProps {
  formData: CompanyFormData;
  onFormDataChange: (updates: Partial<CompanyFormData>) => void;
}

export const CompanyInterviewSettings = ({ formData, onFormDataChange }: CompanyInterviewSettingsProps) => {
  const [interviewType, setInterviewType] = useState<InterviewType>('video');

  return (
    <div className="border-t border-white/10 pt-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="h-5 w-5 text-white" />
          <h4 className="text-base font-semibold text-white">Intervjuinställningar</h4>
        </div>
        <p className="text-sm text-white">Standardvärden som fylls i automatiskt när du bokar intervjuer</p>
      </div>

      <div className="space-y-4">
        <InterviewTypeTabs 
          activeType={interviewType} 
          onTypeChange={setInterviewType} 
        />

        {interviewType === 'video' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="interview_video_link" className="text-white flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  Videolänk
                  <span className="text-white font-normal">(Din Teams, Zoom eller Google Meet-länk som visas för kandidater)</span>
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Input
                  id="interview_video_link"
                  value={formData.interview_video_link}
                  onChange={(e) => onFormDataChange({ interview_video_link: e.target.value })}
                  placeholder="https://teams.microsoft.com/... eller https://meet.google.com/..."
                  className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 [&]:text-white flex-1"
                />
                
                {formData.interview_video_link && isValidMeetingLink(formData.interview_video_link) && (
                  <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                )}
                {formData.interview_video_link && !isValidMeetingLink(formData.interview_video_link) && (
                  <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                )}
              </div>
              
              {formData.interview_video_link && !isValidMeetingLink(formData.interview_video_link) && (
                <p className="text-amber-400 text-xs">
                  Länken ser inte ut som en giltig möteslänk från Teams, Zoom, Google Meet, Webex, Whereby, Jitsi, Skype, GoToMeeting eller BlueJeans.
                </p>
              )}
              
              {formData.interview_video_link && isValidMeetingLink(formData.interview_video_link) && (
                <p className="text-green-400 text-xs">Giltig möteslänk</p>
              )}
              
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-white hover:text-white/80 transition-colors">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Hur får jag min videolänk?</span>
                  <ChevronDown className="h-3 w-3" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-white/5 rounded-lg p-3 space-y-3 text-xs text-white">
                    <div className="space-y-1">
                      <p className="font-medium text-white flex items-center gap-1.5">
                        <span className="text-blue-400">Microsoft Teams</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 ml-1 text-white">
                        <li>Öppna Teams → Kalender</li>
                        <li>Klicka "Nytt möte" eller "Möt nu"</li>
                        <li>Kopiera möteslänken</li>
                      </ol>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-white flex items-center gap-1.5">
                        <span className="text-green-400">Google Meet</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 ml-1 text-white">
                        <li>Gå till <a href="https://meet.google.com" target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-white/80">meet.google.com</a></li>
                        <li>Klicka "Nytt möte" → "Skapa ett möte för senare"</li>
                        <li>Kopiera länken</li>
                      </ol>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-white flex items-center gap-1.5">
                        <span className="text-blue-300">Zoom</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 ml-1 text-white">
                        <li>Öppna Zoom-appen</li>
                        <li>Gå till "Profil" → "Personal Meeting ID"</li>
                        <li>Kopiera din personliga möteslänk</li>
                      </ol>
                    </div>
                    <p className="text-white pt-1 border-t border-white/10">
                      💡 Tips: Använd din personliga möteslänk så behöver du bara fylla i den en gång!
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="space-y-1.5 pt-4 mt-2 border-t border-white/10">
              <Label htmlFor="interview_video_default_message" className="text-white flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Standardmeddelande för video
              </Label>
              <Textarea
                id="interview_video_default_message"
                value={formData.interview_video_default_message}
                onChange={(e) => onFormDataChange({ interview_video_default_message: e.target.value })}
                placeholder="Hej!&#10;&#10;Tack för din ansökan. Vi skulle gärna vilja träffa dig på en videointervju.&#10;&#10;Vänliga hälsningar"
                rows={4}
                className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white resize-none [&]:text-white"
              />
              <p className="text-xs text-white">Detta meddelande skickas till kandidaten vid videobokning</p>
            </div>
          </motion.div>
        )}

        {interviewType === 'kontor' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="interview_office_address" className="text-white flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Intervjuadress
              </Label>
              <Input
                id="interview_office_address"
                value={formData.interview_office_address}
                onChange={(e) => onFormDataChange({ interview_office_address: e.target.value })}
                placeholder="Storgatan 1, 111 22 Stockholm"
                className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white h-11 !min-h-0 [&]:text-white"
              />
              <p className="text-xs text-white">Adressen som visas för kandidater vid fysiska intervjuer</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interview_office_instructions" className="text-white">
                Instruktioner till kandidaten
              </Label>
              <Textarea
                id="interview_office_instructions"
                value={formData.interview_office_instructions}
                onChange={(e) => onFormDataChange({ interview_office_instructions: e.target.value })}
                placeholder="T.ex. parkering, ingång, vem de ska fråga efter..."
                rows={2}
                className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white resize-none [&]:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interview_default_message" className="text-white flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Standardmeddelande för kontor
              </Label>
              <Textarea
                id="interview_default_message"
                value={formData.interview_default_message}
                onChange={(e) => onFormDataChange({ interview_default_message: e.target.value })}
                placeholder="Hej!&#10;&#10;Tack för din ansökan. Vi skulle gärna vilja träffa dig på en intervju.&#10;&#10;Vänliga hälsningar"
                rows={4}
                className="bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white resize-none [&]:text-white"
              />
              <p className="text-xs text-white">Detta meddelande skickas till kandidaten vid kontorsbokning</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
