import { useState, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { JobQuestion, createEmptyQuestion } from '@/types/jobWizard';

interface UseJobQuestionsOptions {
  initialQuestions?: JobQuestion[];
  onQuestionsChange?: (questions: JobQuestion[]) => void;
}

export const useJobQuestions = (options: UseJobQuestionsOptions = {}) => {
  const { initialQuestions = [], onQuestionsChange } = options;
  
  const [questions, setQuestions] = useState<JobQuestion[]>(initialQuestions);
  const [editingQuestion, setEditingQuestion] = useState<JobQuestion | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showQuestionTemplates, setShowQuestionTemplates] = useState(false);
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');

  // Update questions and notify parent
  const updateQuestions = useCallback((newQuestions: JobQuestion[]) => {
    setQuestions(newQuestions);
    onQuestionsChange?.(newQuestions);
  }, [onQuestionsChange]);

  // Add a new question
  const addQuestion = useCallback((question?: Partial<JobQuestion>) => {
    const newQuestion: JobQuestion = {
      ...createEmptyQuestion(),
      ...question,
      id: question?.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order_index: questions.length,
    };
    
    setEditingQuestion(newQuestion);
    setShowQuestionForm(true);
  }, [questions.length]);

  // Start editing an existing question
  const startEditQuestion = useCallback((question: JobQuestion) => {
    setEditingQuestion({ ...question });
    setShowQuestionForm(true);
  }, []);

  // Save the current editing question
  const saveQuestion = useCallback(() => {
    if (!editingQuestion || !editingQuestion.question_text.trim()) return false;

    const existingIndex = questions.findIndex(q => q.id === editingQuestion.id);
    
    let newQuestions: JobQuestion[];
    if (existingIndex >= 0) {
      // Update existing
      newQuestions = [...questions];
      newQuestions[existingIndex] = editingQuestion;
    } else {
      // Add new
      newQuestions = [...questions, { ...editingQuestion, order_index: questions.length }];
    }
    
    updateQuestions(newQuestions);
    setEditingQuestion(null);
    setShowQuestionForm(false);
    return true;
  }, [editingQuestion, questions, updateQuestions]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingQuestion(null);
    setShowQuestionForm(false);
  }, []);

  // Delete a question
  const deleteQuestion = useCallback((questionId: string) => {
    const newQuestions = questions
      .filter(q => q.id !== questionId)
      .map((q, index) => ({ ...q, order_index: index }));
    updateQuestions(newQuestions);
  }, [questions, updateQuestions]);

  // Handle drag end for reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);
      
      const reordered = arrayMove(questions, oldIndex, newIndex).map((q, index) => ({
        ...q,
        order_index: index
      }));
      
      updateQuestions(reordered);
    }
  }, [questions, updateQuestions]);

  // Update a field on the editing question
  const updateQuestionField = useCallback(<K extends keyof JobQuestion>(
    field: K,
    value: JobQuestion[K]
  ) => {
    if (!editingQuestion) return;
    setEditingQuestion(prev => prev ? { ...prev, [field]: value } : null);
  }, [editingQuestion]);

  // Add option to multiple choice question
  const addOption = useCallback(() => {
    if (!editingQuestion) return;
    const options = [...(editingQuestion.options || []), ''];
    updateQuestionField('options', options);
  }, [editingQuestion, updateQuestionField]);

  // Update a specific option
  const updateOption = useCallback((index: number, value: string) => {
    if (!editingQuestion) return;
    const options = [...(editingQuestion.options || [])];
    options[index] = value;
    updateQuestionField('options', options);
  }, [editingQuestion, updateQuestionField]);

  // Remove an option
  const removeOption = useCallback((index: number) => {
    if (!editingQuestion) return;
    const options = (editingQuestion.options || []).filter((_, i) => i !== index);
    updateQuestionField('options', options);
  }, [editingQuestion, updateQuestionField]);

  // Add from template
  const addFromTemplate = useCallback((template: JobQuestion) => {
    const newQuestion: JobQuestion = {
      ...template,
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      template_id: template.id,
      order_index: questions.length,
    };
    updateQuestions([...questions, newQuestion]);
    setShowQuestionTemplates(false);
  }, [questions, updateQuestions]);

  // Filter questions by search
  const filteredQuestions = questionSearchQuery
    ? questions.filter(q => 
        q.question_text.toLowerCase().includes(questionSearchQuery.toLowerCase())
      )
    : questions;

  // Reset all
  const resetQuestions = useCallback((newQuestions: JobQuestion[] = []) => {
    setQuestions(newQuestions);
    setEditingQuestion(null);
    setShowQuestionForm(false);
    setShowQuestionTemplates(false);
    setQuestionSearchQuery('');
  }, []);

  return {
    // State
    questions,
    editingQuestion,
    showQuestionForm,
    showQuestionTemplates,
    questionSearchQuery,
    filteredQuestions,
    
    // Setters
    setQuestions: updateQuestions,
    setEditingQuestion,
    setShowQuestionForm,
    setShowQuestionTemplates,
    setQuestionSearchQuery,
    
    // Actions
    addQuestion,
    startEditQuestion,
    saveQuestion,
    cancelEdit,
    deleteQuestion,
    handleDragEnd,
    updateQuestionField,
    addOption,
    updateOption,
    removeOption,
    addFromTemplate,
    resetQuestions,
  };
};

export type UseJobQuestionsReturn = ReturnType<typeof useJobQuestions>;
