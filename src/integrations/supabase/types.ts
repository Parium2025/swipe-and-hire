export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      candidate_activities: {
        Row: {
          activity_type: string
          applicant_id: string
          created_at: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          applicant_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          applicant_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: []
      }
      candidate_evaluations: {
        Row: {
          applicant_id: string
          application_id: string | null
          created_at: string
          error_message: string | null
          evaluated_at: string | null
          evaluated_by: string | null
          id: string
          job_id: string
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          application_id?: string | null
          created_at?: string
          error_message?: string | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          id?: string
          job_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          application_id?: string | null
          created_at?: string
          error_message?: string | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          id?: string
          job_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_evaluations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evaluations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_notes: {
        Row: {
          applicant_id: string
          created_at: string
          employer_id: string
          id: string
          job_id: string | null
          note: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          employer_id: string
          id?: string
          job_id?: string | null
          note: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          employer_id?: string
          id?: string
          job_id?: string | null
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_notes_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "candidate_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_ratings: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          job_id: string | null
          rating: number
          recruiter_id: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          job_id?: string | null
          rating?: number
          recruiter_id: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          job_id?: string | null
          rating?: number
          recruiter_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_summaries: {
        Row: {
          applicant_id: string
          application_id: string | null
          created_at: string
          generated_at: string
          id: string
          job_id: string
          key_points: Json | null
          summary_text: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          application_id?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          job_id: string
          key_points?: Json | null
          summary_text: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          application_id?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          job_id?: string
          key_points?: Json | null
          summary_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_summaries_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_summaries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      company_reviews: {
        Row: {
          comment: string | null
          company_id: string
          created_at: string
          id: string
          is_anonymous: boolean | null
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          is_admin: boolean
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_system_message: boolean
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_system_message?: boolean
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_system_message?: boolean
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          application_id: string | null
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          job_id: string | null
          last_message_at: string | null
          name: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          job_id?: string | null
          last_message_at?: string | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          job_id?: string | null
          last_message_at?: string | null
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      criterion_results: {
        Row: {
          confidence: number | null
          created_at: string
          criterion_id: string
          evaluation_id: string
          id: string
          reasoning: string | null
          result: string
          source: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          criterion_id: string
          evaluation_id: string
          id?: string
          reasoning?: string | null
          result: string
          source?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          criterion_id?: string
          evaluation_id?: string
          id?: string
          reasoning?: string | null
          result?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criterion_results_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "job_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criterion_results_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "candidate_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_analysis_queue: {
        Row: {
          applicant_id: string
          application_id: string | null
          attempts: number
          completed_at: string | null
          created_at: string
          cv_url: string
          error_message: string | null
          id: string
          job_id: string | null
          max_attempts: number
          priority: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          application_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          cv_url: string
          error_message?: string | null
          id?: string
          job_id?: string | null
          max_attempts?: number
          priority?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          application_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          cv_url?: string
          error_message?: string | null
          id?: string
          job_id?: string | null
          max_attempts?: number
          priority?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_analysis_queue_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_analysis_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_career_tips: {
        Row: {
          category: string
          created_at: string
          gradient: string | null
          icon_name: string | null
          id: string
          is_translated: boolean | null
          news_date: string
          order_index: number | null
          published_at: string | null
          source: string
          source_url: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          gradient?: string | null
          icon_name?: string | null
          id?: string
          is_translated?: boolean | null
          news_date?: string
          order_index?: number | null
          published_at?: string | null
          source: string
          source_url?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          gradient?: string | null
          icon_name?: string | null
          id?: string
          is_translated?: boolean | null
          news_date?: string
          order_index?: number | null
          published_at?: string | null
          source?: string
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_hr_news: {
        Row: {
          category: string
          created_at: string
          gradient: string | null
          icon_name: string | null
          id: string
          image_url: string | null
          is_translated: boolean | null
          news_date: string
          order_index: number
          published_at: string | null
          source: string
          source_url: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          gradient?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_translated?: boolean | null
          news_date?: string
          order_index?: number
          published_at?: string | null
          source: string
          source_url?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          gradient?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_translated?: boolean | null
          news_date?: string
          order_index?: number
          published_at?: string | null
          source?: string
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_push_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_confirmations: {
        Row: {
          confirmed_at: string | null
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      employer_notes: {
        Row: {
          content: string
          created_at: string
          employer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          employer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          employer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          applicant_id: string
          application_id: string | null
          created_at: string
          duration_minutes: number
          employer_id: string
          id: string
          job_id: string | null
          location_details: string | null
          location_type: string
          message: string | null
          scheduled_at: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          applicant_id: string
          application_id?: string | null
          created_at?: string
          duration_minutes?: number
          employer_id: string
          id?: string
          job_id?: string | null
          location_details?: string | null
          location_type?: string
          message?: string | null
          scheduled_at: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          application_id?: string | null
          created_at?: string
          duration_minutes?: number
          employer_id?: string
          id?: string
          job_id?: string | null
          location_details?: string | null
          location_type?: string
          message?: string | null
          scheduled_at?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          age: number | null
          applicant_id: string
          applied_at: string | null
          availability: string | null
          bio: string | null
          cover_letter: string | null
          created_at: string
          custom_answers: Json | null
          cv_url: string | null
          email: string | null
          employment_status: string | null
          first_name: string | null
          id: string
          job_id: string
          last_name: string | null
          location: string | null
          phone: string | null
          profile_image_snapshot_url: string | null
          search_vector: unknown
          status: string
          updated_at: string
          video_snapshot_url: string | null
          viewed_at: string | null
          work_schedule: string | null
        }
        Insert: {
          age?: number | null
          applicant_id: string
          applied_at?: string | null
          availability?: string | null
          bio?: string | null
          cover_letter?: string | null
          created_at?: string
          custom_answers?: Json | null
          cv_url?: string | null
          email?: string | null
          employment_status?: string | null
          first_name?: string | null
          id?: string
          job_id: string
          last_name?: string | null
          location?: string | null
          phone?: string | null
          profile_image_snapshot_url?: string | null
          search_vector?: unknown
          status?: string
          updated_at?: string
          video_snapshot_url?: string | null
          viewed_at?: string | null
          work_schedule?: string | null
        }
        Update: {
          age?: number | null
          applicant_id?: string
          applied_at?: string | null
          availability?: string | null
          bio?: string | null
          cover_letter?: string | null
          created_at?: string
          custom_answers?: Json | null
          cv_url?: string | null
          email?: string | null
          employment_status?: string | null
          first_name?: string | null
          id?: string
          job_id?: string
          last_name?: string | null
          location?: string | null
          phone?: string | null
          profile_image_snapshot_url?: string | null
          search_vector?: unknown
          status?: string
          updated_at?: string
          video_snapshot_url?: string | null
          viewed_at?: string | null
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_criteria: {
        Row: {
          created_at: string
          employer_id: string
          id: string
          is_active: boolean
          job_id: string
          order_index: number
          prompt: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employer_id: string
          id?: string
          is_active?: boolean
          job_id: string
          order_index?: number
          prompt: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employer_id?: string
          id?: string
          is_active?: boolean
          job_id?: string
          order_index?: number
          prompt?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_criteria_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          application_instructions: string | null
          applications_count: number | null
          benefits: string[] | null
          category: string | null
          contact_email: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          employer_id: string
          employment_type: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          job_image_desktop_url: string | null
          job_image_url: string | null
          location: string | null
          occupation: string | null
          pitch: string | null
          positions_count: number | null
          remote_work_possible: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          salary_transparency: string | null
          salary_type: string | null
          search_vector: unknown
          title: string
          updated_at: string
          views_count: number | null
          work_end_time: string | null
          work_location_type: string | null
          work_schedule: string | null
          work_start_time: string | null
          workplace_address: string | null
          workplace_city: string | null
          workplace_county: string | null
          workplace_municipality: string | null
          workplace_name: string | null
          workplace_postal_code: string | null
        }
        Insert: {
          application_instructions?: string | null
          applications_count?: number | null
          benefits?: string[] | null
          category?: string | null
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          employer_id: string
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          job_image_desktop_url?: string | null
          job_image_url?: string | null
          location?: string | null
          occupation?: string | null
          pitch?: string | null
          positions_count?: number | null
          remote_work_possible?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_transparency?: string | null
          salary_type?: string | null
          search_vector?: unknown
          title: string
          updated_at?: string
          views_count?: number | null
          work_end_time?: string | null
          work_location_type?: string | null
          work_schedule?: string | null
          work_start_time?: string | null
          workplace_address?: string | null
          workplace_city?: string | null
          workplace_county?: string | null
          workplace_municipality?: string | null
          workplace_name?: string | null
          workplace_postal_code?: string | null
        }
        Update: {
          application_instructions?: string | null
          applications_count?: number | null
          benefits?: string[] | null
          category?: string | null
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          employer_id?: string
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          job_image_desktop_url?: string | null
          job_image_url?: string | null
          location?: string | null
          occupation?: string | null
          pitch?: string | null
          positions_count?: number | null
          remote_work_possible?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_transparency?: string | null
          salary_type?: string | null
          search_vector?: unknown
          title?: string
          updated_at?: string
          views_count?: number | null
          work_end_time?: string | null
          work_location_type?: string | null
          work_schedule?: string | null
          work_start_time?: string | null
          workplace_address?: string | null
          workplace_city?: string | null
          workplace_county?: string | null
          workplace_municipality?: string | null
          workplace_name?: string | null
          workplace_postal_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_question_templates: {
        Row: {
          created_at: string
          employer_id: string
          id: string
          options: string[] | null
          placeholder_text: string | null
          question_text: string
          question_type: string
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          created_at?: string
          employer_id: string
          id?: string
          options?: string[] | null
          placeholder_text?: string | null
          question_text: string
          question_type: string
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          created_at?: string
          employer_id?: string
          id?: string
          options?: string[] | null
          placeholder_text?: string | null
          question_text?: string
          question_type?: string
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      job_questions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean | null
          job_id: string
          max_value: number | null
          min_value: number | null
          options: string[] | null
          order_index: number
          placeholder_text: string | null
          question_text: string
          question_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          job_id: string
          max_value?: number | null
          min_value?: number | null
          options?: string[] | null
          order_index?: number
          placeholder_text?: string | null
          question_text: string
          question_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          job_id?: string
          max_value?: number | null
          min_value?: number | null
          options?: string[] | null
          order_index?: number
          placeholder_text?: string | null
          question_text?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stage_settings: {
        Row: {
          color: string | null
          created_at: string
          custom_label: string | null
          icon_name: string | null
          id: string
          is_custom: boolean
          job_id: string
          order_index: number
          stage_key: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          custom_label?: string | null
          icon_name?: string | null
          id?: string
          is_custom?: boolean
          job_id: string
          order_index?: number
          stage_key: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          custom_label?: string | null
          icon_name?: string | null
          id?: string
          is_custom?: boolean
          job_id?: string
          order_index?: number
          stage_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_stage_settings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_templates: {
        Row: {
          application_instructions: string | null
          benefits: string[] | null
          contact_email: string | null
          created_at: string
          description: string | null
          employer_id: string
          employment_type: string | null
          id: string
          is_default: boolean | null
          location: string | null
          name: string
          occupation: string | null
          pitch: string | null
          positions_count: string | null
          questions: Json | null
          remote_work_possible: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          salary_transparency: string | null
          salary_type: string | null
          title: string
          updated_at: string
          work_location_type: string | null
          work_schedule: string | null
          workplace_address: string | null
          workplace_city: string | null
          workplace_county: string | null
          workplace_municipality: string | null
          workplace_name: string | null
          workplace_postal_code: string | null
        }
        Insert: {
          application_instructions?: string | null
          benefits?: string[] | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          employer_id: string
          employment_type?: string | null
          id?: string
          is_default?: boolean | null
          location?: string | null
          name: string
          occupation?: string | null
          pitch?: string | null
          positions_count?: string | null
          questions?: Json | null
          remote_work_possible?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_transparency?: string | null
          salary_type?: string | null
          title: string
          updated_at?: string
          work_location_type?: string | null
          work_schedule?: string | null
          workplace_address?: string | null
          workplace_city?: string | null
          workplace_county?: string | null
          workplace_municipality?: string | null
          workplace_name?: string | null
          workplace_postal_code?: string | null
        }
        Update: {
          application_instructions?: string | null
          benefits?: string[] | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          employer_id?: string
          employment_type?: string | null
          id?: string
          is_default?: boolean | null
          location?: string | null
          name?: string
          occupation?: string | null
          pitch?: string | null
          positions_count?: string | null
          questions?: Json | null
          remote_work_possible?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_transparency?: string | null
          salary_type?: string | null
          title?: string
          updated_at?: string
          work_location_type?: string | null
          work_schedule?: string | null
          workplace_address?: string | null
          workplace_city?: string | null
          workplace_county?: string | null
          workplace_municipality?: string | null
          workplace_name?: string | null
          workplace_postal_code?: string | null
        }
        Relationships: []
      }
      job_views: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      jobseeker_notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      link_previews: {
        Row: {
          created_at: string
          description: string | null
          favicon_url: string | null
          fetched_at: string
          id: string
          image_url: string | null
          site_name: string | null
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          favicon_url?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          site_name?: string | null
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          favicon_url?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          site_name?: string | null
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          is_read: boolean
          job_id: string | null
          recipient_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          job_id?: string | null
          recipient_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          job_id?: string | null
          recipient_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      my_candidates: {
        Row: {
          applicant_id: string
          application_id: string
          created_at: string
          id: string
          job_id: string | null
          notes: string | null
          rating: number | null
          recruiter_id: string
          stage: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          application_id: string
          created_at?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          rating?: number | null
          recruiter_id: string
          stage?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          application_id?: string
          created_at?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          rating?: number | null
          recruiter_id?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_recruiters: number | null
          name: string
          subscription_plan: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_recruiters?: number | null
          name: string
          subscription_plan?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_recruiters?: number | null
          name?: string
          subscription_plan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profile_cv_summaries: {
        Row: {
          analyzed_at: string
          created_at: string
          cv_url: string
          document_type: string | null
          id: string
          is_valid_cv: boolean
          key_points: Json | null
          summary_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analyzed_at?: string
          created_at?: string
          cv_url: string
          document_type?: string | null
          id?: string
          is_valid_cv?: boolean
          key_points?: Json | null
          summary_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analyzed_at?: string
          created_at?: string
          cv_url?: string
          document_type?: string | null
          id?: string
          is_valid_cv?: boolean
          key_points?: Json | null
          summary_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_view_permissions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          profile_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          availability: string | null
          background_location_enabled: boolean | null
          bio: string | null
          birth_date: string | null
          city: string | null
          company_description: string | null
          company_logo_original_url: string | null
          company_logo_url: string | null
          company_name: string | null
          cover_image_url: string | null
          created_at: string
          cv_url: string | null
          email: string | null
          employee_count: string | null
          employment_type: string | null
          first_name: string | null
          home_location: string | null
          id: string
          industry: string | null
          interests: string[] | null
          interview_default_message: string | null
          interview_office_address: string | null
          interview_office_instructions: string | null
          interview_video_default_message: string | null
          interview_video_link: string | null
          is_profile_video: boolean | null
          last_active_at: string | null
          last_name: string | null
          location: string | null
          not_currently_looking: boolean | null
          occupation: string | null
          onboarding_completed: boolean | null
          org_number: string | null
          organization_id: string | null
          phone: string | null
          postal_code: string | null
          profile_file_name: string | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          social_media_links: Json | null
          updated_at: string
          user_id: string
          video_url: string | null
          website: string | null
          work_schedule: string | null
        }
        Insert: {
          address?: string | null
          availability?: string | null
          background_location_enabled?: boolean | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          company_description?: string | null
          company_logo_original_url?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          employee_count?: string | null
          employment_type?: string | null
          first_name?: string | null
          home_location?: string | null
          id?: string
          industry?: string | null
          interests?: string[] | null
          interview_default_message?: string | null
          interview_office_address?: string | null
          interview_office_instructions?: string | null
          interview_video_default_message?: string | null
          interview_video_link?: string | null
          is_profile_video?: boolean | null
          last_active_at?: string | null
          last_name?: string | null
          location?: string | null
          not_currently_looking?: boolean | null
          occupation?: string | null
          onboarding_completed?: boolean | null
          org_number?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_file_name?: string | null
          profile_image_url?: string | null
          role: Database["public"]["Enums"]["user_role"]
          social_media_links?: Json | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          website?: string | null
          work_schedule?: string | null
        }
        Update: {
          address?: string | null
          availability?: string | null
          background_location_enabled?: boolean | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          company_description?: string | null
          company_logo_original_url?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          employee_count?: string | null
          employment_type?: string | null
          first_name?: string | null
          home_location?: string | null
          id?: string
          industry?: string | null
          interests?: string[] | null
          interview_default_message?: string | null
          interview_office_address?: string | null
          interview_office_instructions?: string | null
          interview_video_default_message?: string | null
          interview_video_link?: string | null
          is_profile_video?: boolean | null
          last_active_at?: string | null
          last_name?: string | null
          location?: string | null
          not_currently_looking?: boolean | null
          occupation?: string | null
          onboarding_completed?: boolean | null
          org_number?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_file_name?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          social_media_links?: Json | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          website?: string | null
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rss_source_health: {
        Row: {
          consecutive_failures: number
          created_at: string
          id: string
          is_active: boolean | null
          is_healthy: boolean
          last_check_at: string | null
          last_error: string | null
          last_error_message: string | null
          last_failure_at: string | null
          last_item_count: number | null
          last_success_at: string | null
          source_name: string
          source_type: string | null
          source_url: string
          successful_fetches: number | null
          total_failures: number
          total_fetches: number | null
          total_successes: number
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_healthy?: boolean
          last_check_at?: string | null
          last_error?: string | null
          last_error_message?: string | null
          last_failure_at?: string | null
          last_item_count?: number | null
          last_success_at?: string | null
          source_name: string
          source_type?: string | null
          source_url: string
          successful_fetches?: number | null
          total_failures?: number
          total_fetches?: number | null
          total_successes?: number
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_healthy?: boolean
          last_check_at?: string | null
          last_error?: string | null
          last_error_message?: string | null
          last_failure_at?: string | null
          last_item_count?: number | null
          last_success_at?: string | null
          source_name?: string
          source_type?: string | null
          source_url?: string
          successful_fetches?: number | null
          total_failures?: number
          total_fetches?: number | null
          total_successes?: number
          updated_at?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          category: string | null
          city: string | null
          county: string | null
          created_at: string
          employment_types: string[] | null
          id: string
          last_checked_at: string
          last_notified_at: string | null
          name: string
          new_matches_count: number
          salary_max: number | null
          salary_min: number | null
          search_query: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          employment_types?: string[] | null
          id?: string
          last_checked_at?: string
          last_notified_at?: string | null
          name: string
          new_matches_count?: number
          salary_max?: number | null
          salary_min?: number | null
          search_query?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          employment_types?: string[] | null
          id?: string
          last_checked_at?: string
          last_notified_at?: string | null
          name?: string
          new_matches_count?: number
          salary_max?: number | null
          salary_min?: number | null
          search_query?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin_reply: boolean | null
          message: string
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean | null
          message: string
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean | null
          message?: string
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string | null
          created_at: string
          id: string
          message: string
          status: string | null
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          message: string
          status?: string | null
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          status?: string | null
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_data_consents: {
        Row: {
          consent_date: string | null
          consent_given: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_date?: string | null
          consent_given?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_date?: string | null
          consent_given?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stage_settings: {
        Row: {
          color: string | null
          created_at: string
          custom_label: string | null
          icon_name: string | null
          id: string
          is_custom: boolean
          order_index: number
          stage_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          custom_label?: string | null
          icon_name?: string | null
          id?: string
          is_custom?: boolean
          order_index?: number
          stage_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          custom_label?: string | null
          icon_name?: string | null
          id?: string
          is_custom?: boolean
          order_index?: number
          stage_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_job_application: { Args: { p_job_id: string }; Returns: boolean }
      complete_cv_analysis: {
        Args: {
          p_error_message?: string
          p_queue_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      count_search_jobs: {
        Args: {
          p_category?: string
          p_city?: string
          p_county?: string
          p_employment_types?: string[]
          p_salary_max?: number
          p_salary_min?: number
          p_search_query?: string
        }
        Returns: number
      }
      delete_note_activities_for_applicant: {
        Args: { p_applicant_id: string }
        Returns: undefined
      }
      employer_owns_job: { Args: { p_job_id: string }; Returns: boolean }
      employer_owns_job_for_question: {
        Args: { p_job_id: string }
        Returns: boolean
      }
      get_applicant_latest_activity: {
        Args: { p_applicant_ids: string[]; p_employer_id: string }
        Returns: {
          applicant_id: string
          last_active_at: string
          latest_application_at: string
        }[]
      }
      get_applicant_profile_image: {
        Args: { p_applicant_id: string; p_employer_id: string }
        Returns: string
      }
      get_applicant_profile_media: {
        Args: { p_applicant_id: string; p_employer_id: string }
        Returns: {
          is_profile_video: boolean
          last_active_at: string
          profile_image_url: string
          video_url: string
        }[]
      }
      get_applicant_profile_media_batch: {
        Args: { p_applicant_ids: string[]; p_employer_id: string }
        Returns: {
          applicant_id: string
          is_profile_video: boolean
          last_active_at: string
          profile_image_url: string
          video_url: string
        }[]
      }
      get_consented_profile_for_employer: {
        Args: { p_employer_id: string; p_profile_id: string }
        Returns: {
          cv_url: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          profile_image_url: string
          user_id: string
          video_url: string
        }[]
      }
      get_cv_queue_batch: {
        Args: { p_batch_size?: number }
        Returns: {
          applicant_id: string
          application_id: string
          cv_url: string
          id: string
          job_id: string
        }[]
      }
      get_user_organization_id: { Args: { p_user_id: string }; Returns: string }
      has_applied_to_employer: {
        Args: { p_applicant_id: string; p_employer_id: string }
        Returns: boolean
      }
      is_conversation_admin: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_org_admin: { Args: { p_user_id: string }; Returns: boolean }
      queue_cv_analysis: {
        Args: {
          p_applicant_id: string
          p_application_id?: string
          p_cv_url: string
          p_job_id?: string
          p_priority?: number
        }
        Returns: string
      }
      record_job_view: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: boolean
      }
      same_organization: {
        Args: { p_user_id_1: string; p_user_id_2: string }
        Returns: boolean
      }
      search_jobs: {
        Args: {
          p_category?: string
          p_city?: string
          p_county?: string
          p_cursor_created_at?: string
          p_employment_types?: string[]
          p_limit?: number
          p_offset?: number
          p_salary_max?: number
          p_salary_min?: number
          p_search_query?: string
        }
        Returns: {
          application_instructions: string
          applications_count: number
          benefits: string[]
          category: string
          contact_email: string
          created_at: string
          description: string
          employer_id: string
          employment_type: string
          expires_at: string
          id: string
          is_active: boolean
          job_image_desktop_url: string
          job_image_url: string
          location: string
          occupation: string
          pitch: string
          positions_count: number
          remote_work_possible: string
          requirements: string
          salary_max: number
          salary_min: number
          salary_transparency: string
          salary_type: string
          search_rank: number
          title: string
          updated_at: string
          views_count: number
          work_location_type: string
          work_schedule: string
          workplace_address: string
          workplace_city: string
          workplace_county: string
          workplace_municipality: string
          workplace_name: string
          workplace_postal_code: string
        }[]
      }
      search_my_candidates: {
        Args: {
          p_cursor_updated_at?: string
          p_limit?: number
          p_recruiter_id: string
          p_search_query: string
        }
        Returns: {
          applicant_id: string
          application_id: string
          created_at: string
          job_id: string
          my_candidate_id: string
          notes: string
          rating: number
          stage: string
          updated_at: string
        }[]
      }
      trigger_career_tips_fetch: { Args: never; Returns: undefined }
      trigger_hr_news_fetch: { Args: never; Returns: undefined }
      try_uuid: { Args: { p_text: string }; Returns: string }
    }
    Enums: {
      user_role: "job_seeker" | "employer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["job_seeker", "employer"],
    },
  },
} as const
