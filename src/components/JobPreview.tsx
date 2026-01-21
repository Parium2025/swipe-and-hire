import { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
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
            className="bg-white/10 border-white/20 text-white placeholder:text-white min-h-[120px] resize-none focus:outline-none focus:border-white/40"
          />
        );

      case 'yes_no':
        return (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleAnswerChange(questionId, currentAnswer === 'yes' ? '' : 'yes')}
              className={
                (currentAnswer === 'yes'
                  ? 'bg-secondary/40 border-secondary text-white '
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/15 ') +
                'border rounded-lg px-6 py-3 text-lg transition-colors font-medium flex-1'
              }
            >
              Ja
            </button>
            <button
              type="button"
              onClick={() => handleAnswerChange(questionId, currentAnswer === 'no' ? '' : 'no')}
              className={
                (currentAnswer === 'no'
                  ? 'bg-secondary/40 border-secondary text-white '
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/15 ') +
                'border rounded-lg px-6 py-3 text-lg transition-colors font-medium flex-1'
              }
            >
              Nej
            </button>
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {question.options?.filter(opt => opt.trim() !== '').map((option, index) => {
              const selectedAnswers = typeof currentAnswer === 'string' 
                ? currentAnswer.split('|||').filter(a => a)
                : Array.isArray(currentAnswer)
                  ? currentAnswer
                  : [];
              const isSelected = selectedAnswers.includes(option);
              
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    const answersArray = typeof currentAnswer === 'string'
                      ? currentAnswer.split('|||').filter(a => a)
                      : Array.isArray(currentAnswer)
                        ? [...currentAnswer]
                        : [];
                    
                    if (answersArray.includes(option)) {
                      const newAnswers = answersArray.filter(a => a !== option);
                      handleAnswerChange(questionId, newAnswers.join('|||'));
                    } else {
                      handleAnswerChange(questionId, [...answersArray, option].join('|||'));
                    }
                  }}
                  className={
                    (isSelected
                      ? 'bg-secondary/40 border-secondary '
                      : 'bg-white/10 border-white/20 hover:bg-white/15 ') +
                    'w-full flex items-center gap-4 rounded-lg px-4 py-3 border transition-colors'
                  }
                >
                  <div className={
                    isSelected
                      ? 'w-3 h-3 rounded-full border border-secondary bg-secondary flex-shrink-0'
                      : 'w-3 h-3 rounded-full border border-white/40 flex-shrink-0'
                  } />
                  <span className="text-lg text-white text-left flex-1">{option}</span>
                </button>
              );
            })}
          </div>
        );

      case 'number':
        const minVal = question.min_value ?? 0;
        const maxVal = question.max_value ?? 100;
        const currentVal = Number(currentAnswer || minVal);
        const percentage = ((currentVal - minVal) / (maxVal - minVal)) * 100;
        
        return (
          <div className="space-y-4">
            <div className="text-center text-2xl font-semibold text-white">
              {currentVal}
            </div>
            <input
              type="range"
              min={minVal}
              max={maxVal}
              value={currentVal}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full"
              style={{
                background: `linear-gradient(to right, white ${percentage}%, rgba(255,255,255,0.3) ${percentage}%)`
              }}
              onChange={(e) => handleAnswerChange(questionId, e.target.value)}
            />
            <div className="flex justify-between text-sm text-white">
              <span>{minVal}</span>
              <span>{maxVal}</span>
            </div>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(questionId, e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white h-12 text-lg focus:outline-none focus:border-white/40"
          />
        );

      case 'file':
        return (
          <div className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center bg-white/5">
            <FileText className="h-8 w-8 mx-auto mb-3 text-white" />
            <p className="text-base text-white">Välj fil</p>
          </div>
        );

      case 'video':
        return (
          <div className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center bg-white/5">
            <Video className="h-8 w-8 mx-auto mb-3 text-white" />
            <p className="text-base text-white">Spela in video</p>
          </div>
        );

      default:
        return (
          <Input
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(questionId, e.target.value)}
            placeholder={question.placeholder_text || 'Skriv ditt svar här...'}
            className="bg-white/10 border-white/20 text-white placeholder:text-white h-12 text-lg focus:outline-none focus:border-white/40"
          />
        );
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="h-6 w-6 text-white" />;
      case 'yes_no': return <CheckSquare className="h-6 w-6 text-white" />;
      case 'multiple_choice': return <List className="h-6 w-6 text-white" />;
      case 'video': return <Video className="h-6 w-6 text-white" />;
      default: return <FileText className="h-6 w-6 text-white" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus className="max-w-full max-h-full h-screen w-screen p-0 bg-gradient-to-br from-primary via-purple-600 to-pink-500 border-none overflow-hidden">
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
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

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
                <div className="flex items-center text-white text-sm">
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
              <div className="flex items-center text-white text-lg">
                <MapPin className="h-5 w-5 mr-3" />
                <span>{jobData.location}</span>
              </div>

              {jobData.employment_type && (
                <div className="flex items-center text-white text-lg">
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
              <p className="text-white leading-relaxed whitespace-pre-wrap">
                {jobData.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex space-x-4">
              <Button 
                variant="outline" 
                size="lg" 
                className="flex-1 border-white/40 text-white h-14 text-lg transition-all duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white"
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
                <div className="text-white text-sm text-center">
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
                  
                  {/* Question header - without icon */}
                  <div>
                    <div className="text-sm mb-2 text-white">
                      Fråga {index + 1} av {jobData.questions.length}
                    </div>
                    <h3 className="text-xl font-bold leading-tight text-white tracking-tight">
                      {question.question_text}
                      {question.is_required && (
                        <span className="ml-1 text-white">*</span>
                      )}
                    </h3>
                  </div>

                  {/* Question input */}
                  <div className="space-y-4">
                    {renderQuestionInput(question)}
                  </div>
                </div>

                {/* Navigation hint */}
                <div className="text-center mt-8">
                  {index < jobData.questions.length - 1 ? (
                    <div className="text-white text-sm">
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
      </DialogContentNoFocus>
    </Dialog>
  );
};

export default JobPreview;