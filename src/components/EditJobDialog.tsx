import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import MobileJobWizard from '@/components/MobileJobWizard';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  employment_type?: string;
  positions_count?: number;
  work_schedule?: string;
  contact_email?: string;
  application_instructions?: string;
  is_active?: boolean;
}

interface EditJobDialogProps {
  job: JobPosting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobUpdated: () => void;
}

const EditJobDialog = ({ job, open, onOpenChange, onJobUpdated }: EditJobDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  return (
    <MobileJobWizard
      open={open}
      onOpenChange={onOpenChange}
      jobTitle={job?.title || ''}
      selectedTemplate={null}
      onJobCreated={() => {}}
      mode="edit"
      editJobId={job?.id}
      onJobUpdated={onJobUpdated}
    />
  );
};

export default EditJobDialog;
