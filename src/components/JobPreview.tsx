import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Euro, Building2, Users, Heart, X, FileText, Video, CheckSquare, List, ArrowLeft, ArrowRight } from 'lucide-react';
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
  const [currentStep, setCurrentStep] = useState(0); // 0 = jobbinfo, 1+ = frågor
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Total steg = jobbinfo + antal frågor
  const totalSteps = 1 + jobData.questions.length;
  const currentQuestion = currentStep > 0 ? jobData.questions[currentStep - 1] : null;

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
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
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3 p-4 rounded-lg bg-white/10 border border-white/20">
                <RadioGroupItem 
                  value={option} 
                  id={`${questionId}-${index}`} 
                  className="text-white border-white/40"
                  checked={currentAnswer === option}
                  onClick={() => handleAnswerChange(questionId, option)}
                />
                <Label htmlFor={`${questionId}-${index}`} className="text-white text-lg cursor-pointer flex-1">
                  {option}
                </Label>
              </div>
            ))}
          </div>
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
      <DialogContent className="max-w-md h-[80vh] p-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 border-none overflow-hidden">
        <div className="flex flex-col h-full relative">
          {/* Header med steg-indikator */}
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center justify-between mb-2">
              <div className="text-white/80 text-sm">Förhandsvisning</div>
              <div className="text-white/80 text-sm">{currentStep + 1} / {totalSteps}</div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {currentStep === 0 ? (
              // Jobbinfo-kort
              <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
                <CardContent className="p-6 space-y-4">
                  {/* Company header - klickbar */}
                  <div 
                    className="flex items-center space-x-3 cursor-pointer hover:bg-white/10 p-2 rounded-lg transition-colors"
                    onClick={onCompanyClick}
                  >
                    <div className="bg-white/20 rounded-full p-2">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">
                        {jobData.company_name || 'Företagsnamn'}
                      </h3>
                      <div className="flex items-center text-white/80 text-sm">
                        <Users className="h-4 w-4 mr-1" />
                        Klicka för att se företagsprofil
                      </div>
                    </div>
                  </div>

                  {/* Job title */}
                  <h2 className="text-white text-xl font-bold">{jobData.title}</h2>

                  {/* Job details */}
                  <div className="space-y-2">
                    <div className="flex items-center text-white/90">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span className="text-sm">{jobData.location}</span>
                    </div>

                    {jobData.employment_type && (
                      <div className="flex items-center text-white/90">
                        <Clock className="h-4 w-4 mr-2" />
                        <span className="text-sm">{getEmploymentTypeLabel(jobData.employment_type)}</span>
                      </div>
                    )}

                    {(jobData.salary_min || jobData.salary_max) && (
                      <div className="flex items-center text-green-300">
                        <Euro className="h-4 w-4 mr-2" />
                        <span className="text-sm font-medium">
                          {formatSalary(jobData.salary_min, jobData.salary_max)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <h4 className="text-white font-semibold">Beskrivning</h4>
                    <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                      {jobData.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3 pt-4">
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="flex-1 border-red-400 text-red-400 hover:bg-red-400/10"
                    >
                      <X className="h-5 w-5 mr-2" />
                      Inte intresserad
                    </Button>
                    <Button 
                      size="lg" 
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                      onClick={jobData.questions.length > 0 ? handleNext : undefined}
                    >
                      <Heart className="h-5 w-5 mr-2" />
                      {jobData.questions.length > 0 ? 'Ansök' : 'Intresserad'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Fråge-kort
              currentQuestion && (
                <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
                  <CardContent className="p-6 space-y-6">
                    {/* Question header */}
                    <div className="flex items-start space-x-3">
                      <div className="bg-white/20 rounded-full p-2 mt-1">
                        {getQuestionIcon(currentQuestion.question_type)}
                        <span className="text-white text-xs">
                          {/* Icon based on question type */}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white text-lg font-semibold mb-2">
                          {currentQuestion.question_text}
                          {currentQuestion.is_required && (
                            <span className="text-red-300 ml-1">*</span>
                          )}
                        </h3>
                      </div>
                    </div>

                    {/* Question input */}
                    <div className="space-y-4">
                      {renderQuestionInput(currentQuestion)}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>

          {/* Navigation footer */}
          <div className="p-4 border-t border-white/20">
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="text-white hover:bg-white/10 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka
              </Button>

              <Button
                onClick={handleNext}
                disabled={currentStep >= totalSteps - 1}
                className="bg-white/20 hover:bg-white/30 text-white disabled:opacity-50"
              >
                {currentStep === totalSteps - 1 ? 'Skicka ansökan' : 'Nästa'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobPreview;