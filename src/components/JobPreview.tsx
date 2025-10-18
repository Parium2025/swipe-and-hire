import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Euro, Building2, Users, Heart, X, FileText, Video, CheckSquare, List } from 'lucide-react';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';

interface JobQuestion {
  id?: string;
  question_text: string;
  question_type: 'text' | 'yes_no' | 'multiple_choice' | 'number' | 'date' | 'file' | 'range' | 'video';
  options?: string[];
  is_required: boolean;
  order_index: number;
  min_value?: number;
  max_value?: number;
  placeholder_text?: string;
}

interface JobPreviewData {
  title: string;
  description: string;
  location: string;
  salary_min?: string;
  salary_max?: string;
  employment_type?: string;
  work_schedule?: string;
  contact_email?: string;
  application_instructions?: string;
  company_name?: string;
  questions: JobQuestion[];
}

interface JobPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobData: JobPreviewData;
  onCompanyClick?: () => void;
}

const JobPreview = ({ open, onOpenChange, jobData, onCompanyClick }: JobPreviewProps) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };


  const formatSalary = (min?: string, max?: string) => {
    if (min && max) {
      return `${parseInt(min).toLocaleString()} - ${parseInt(max).toLocaleString()} kr/mån`;
    }
    if (min) return `Från ${parseInt(min).toLocaleString()} kr/mån`;
    if (max) return `Upp till ${parseInt(max).toLocaleString()} kr/mån`;
    return null;
  };

  const renderQuestionInput = (question: JobQuestion) => {
    const questionId = question.id || `temp_${question.order_index}`;
    const currentAnswer = answers[questionId];

    switch (question.question_type) {
      case 'text':
        return (
          <Textarea
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(questionId, e.target.value)}
            placeholder={question.placeholder_text || 'Skriv ditt svar här...'}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 min-h-[120px] resize-none"
          />
        );

      case 'yes_no':
        return (
          <RadioGroup
            value={currentAnswer || ''}
            onValueChange={(value) => handleAnswerChange(questionId, value)}
            className="space-y-4"
          >
            <div className="flex items-center space-x-3 p-4 rounded-lg bg-white/10 border border-white/20">
              <RadioGroupItem value="yes" id={`${questionId}-yes`} className="text-white border-white/40" />
              <Label htmlFor={`${questionId}-yes`} className="text-white text-lg cursor-pointer flex-1">Ja</Label>
            </div>
            <div className="flex items-center space-x-3 p-4 rounded-lg bg-white/10 border border-white/20">
              <RadioGroupItem value="no" id={`${questionId}-no`} className="text-white border-white/40" />
              <Label htmlFor={`${questionId}-no`} className="text-white text-lg cursor-pointer flex-1">Nej</Label>
            </div>
          </RadioGroup>
        );

      case 'multiple_choice':
        return (
          <RadioGroup
            value={currentAnswer || ''}
            onValueChange={(value) => handleAnswerChange(questionId, value)}
            className="space-y-3"
          >
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3 p-4 rounded-lg bg-white/10 border border-white/20">
                <RadioGroupItem 
                  value={option} 
                  id={`${questionId}-${index}`} 
                  className="text-white border-white/40"
                />
                <Label htmlFor={`${questionId}-${index}`} className="text-white text-lg cursor-pointer flex-1">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(questionId, e.target.value)}
            placeholder={question.placeholder_text || 'Ange ett tal...'}
            min={question.min_value}
            max={question.max_value}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-lg"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(questionId, e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-lg"
          />
        );

      case 'file':
        return (
          <div className="bg-white/10 border border-white/20 rounded-lg p-6 text-center">
            <FileText className="h-12 w-12 text-white/60 mx-auto mb-3" />
            <p className="text-white/80 mb-4">Ladda upp en fil</p>
            <Button variant="outline" className="border-white/40 text-white hover:bg-white/10">
              Välj fil
            </Button>
          </div>
        );

      case 'video':
        return (
          <div className="bg-white/10 border border-white/20 rounded-lg p-6 text-center">
            <Video className="h-12 w-12 text-white/60 mx-auto mb-3" />
            <p className="text-white/80 mb-4">Spela in en kort video</p>
            <Button variant="outline" className="border-white/40 text-white hover:bg-white/10">
              Starta inspelning
            </Button>
          </div>
        );

      default:
        return (
          <Input
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(questionId, e.target.value)}
            placeholder={question.placeholder_text || 'Ditt svar...'}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-lg"
          />
        );
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="h-6 w-6" />;
      case 'yes_no': return <CheckSquare className="h-6 w-6" />;
      case 'multiple_choice': return <List className="h-6 w-6" />;
      case 'video': return <Video className="h-6 w-6" />;
      default: return <FileText className="h-6 w-6" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full max-h-full h-screen w-screen p-0 bg-gradient-to-br from-primary via-purple-600 to-pink-500 border-none overflow-hidden">
        <div className="sr-only">
          <DialogHeader>
            <DialogTitle>Jobbförhandsvisning</DialogTitle>
            <DialogDescription>Förhandsgranskning av annons och frågor.</DialogDescription>
          </DialogHeader>
        </div>
        {/* Hinge-style fullscreen scrollable content */}
        <div className="h-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory">
          
          {/* Första kortet: Jobbinfo (stora kort som täcker hela skärmen) */}
          <div className="min-h-screen snap-start flex flex-col justify-center px-6 py-12 relative">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/10"
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Company header - klickbar */}
            <div 
              className="flex items-center space-x-4 cursor-pointer hover:bg-white/10 p-4 rounded-xl transition-colors mb-6"
              onClick={onCompanyClick}
            >
              <div className="bg-white/20 rounded-full p-3">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-xl">
                  {jobData.company_name || 'Företagsnamn'}
                </h3>
                <div className="flex items-center text-white/80 text-sm">
                  <Users className="h-4 w-4 mr-1" />
                  Klicka för att se företagsprofil
                </div>
              </div>
            </div>

            {/* Job title - stor och framträdande */}
            <h1 className="text-white text-3xl font-bold mb-4 leading-tight">
              {jobData.title}
            </h1>

            {/* Job details */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-white/90 text-lg">
                <MapPin className="h-5 w-5 mr-3" />
                <span>{jobData.location}</span>
              </div>

              {jobData.employment_type && (
                <div className="flex items-center text-white/90 text-lg">
                  <Clock className="h-5 w-5 mr-3" />
                  <span>{getEmploymentTypeLabel(jobData.employment_type)}</span>
                </div>
              )}

              {(jobData.salary_min || jobData.salary_max) && (
                <div className="flex items-center text-green-300 text-lg font-medium">
                  <Euro className="h-5 w-5 mr-3" />
                  <span>
                    {formatSalary(jobData.salary_min, jobData.salary_max)}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white/10 rounded-xl p-6 mb-8">
              <h4 className="text-white font-semibold text-lg mb-3">Beskrivning</h4>
              <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                {jobData.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex space-x-4">
              <Button 
                variant="outline" 
                size="lg" 
                className="flex-1 border-white/40 text-white hover:bg-white/10 h-14 text-lg"
              >
                <X className="h-6 w-6 mr-2" />
                Inte intresserad
              </Button>
              <Button 
                size="lg" 
                className="flex-1 bg-white/20 hover:bg-white/30 text-white h-14 text-lg backdrop-blur-sm"
              >
                <Heart className="h-6 w-6 mr-2" />
                {jobData.questions.length > 0 ? 'Börja ansöka' : 'Intresserad'}
              </Button>
            </div>

            {/* Scroll hint */}
            {jobData.questions.length > 0 && (
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                <div className="text-white/70 text-sm text-center">
                  <div className="animate-bounce mb-2">↓</div>
                  Scrolla för att se frågorna
                </div>
              </div>
            )}
          </div>

          {/* Fråge-kort - ett kort per fråga i Hinge-stil */}
          {jobData.questions.map((question, index) => {
            const questionId = question.id || `temp_${question.order_index}`;
            
            return (
              <div key={questionId} className="min-h-screen snap-start flex flex-col justify-center px-6 py-12">
                
                {/* Question card */}
                <div className="bg-white/10 rounded-2xl p-8 space-y-6">
                  
                  {/* Question header */}
                  <div className="flex items-start space-x-4">
                    <div className="bg-white/20 rounded-full p-3 mt-1">
                      {getQuestionIcon(question.question_type)}
                    </div>
                    <div className="flex-1">
                      <div className="text-white/80 text-sm mb-2">
                        Fråga {index + 1} av {jobData.questions.length}
                      </div>
                      <h3 className="text-white text-xl font-bold leading-tight">
                        {question.question_text}
                        {question.is_required && (
                          <span className="text-red-300 ml-1">*</span>
                        )}
                      </h3>
                    </div>
                  </div>

                  {/* Question input */}
                  <div className="space-y-4">
                    {renderQuestionInput(question)}
                  </div>
                </div>

                {/* Navigation hint */}
                <div className="text-center mt-8">
                  {index < jobData.questions.length - 1 ? (
                    <div className="text-white/70 text-sm">
                      <div className="animate-bounce mb-2">↓</div>
                      Nästa fråga
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      className="bg-green-500 hover:bg-green-600 text-white h-14 px-8 text-lg"
                    >
                      Skicka ansökan
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobPreview;