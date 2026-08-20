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
      account_deletion_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          email: string | null
          last_error: string | null
          requested_at: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          email?: string | null
          last_error?: string | null
          requested_at?: string
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          email?: string | null
          last_error?: string | null
          requested_at?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      account_inactivity_notices: {
        Row: {
          cancelled_at: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          error_message: string | null
          id: string
          last_active_at: string | null
          reminder_1_sent_at: string | null
          reminder_180_sent_at: string | null
          reminder_30_sent_at: string | null
          reminder_7_sent_at: string | null
          reminder_90_sent_at: string | null
          scheduled_delete_at: string
          updated_at: string
          user_id: string
          warned_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          last_active_at?: string | null
          reminder_1_sent_at?: string | null
          reminder_180_sent_at?: string | null
          reminder_30_sent_at?: string | null
          reminder_7_sent_at?: string | null
          reminder_90_sent_at?: string | null
          scheduled_delete_at: string
          updated_at?: string
          user_id: string
          warned_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          last_active_at?: string | null
          reminder_1_sent_at?: string | null
          reminder_180_sent_at?: string | null
          reminder_30_sent_at?: string | null
          reminder_7_sent_at?: string | null
          reminder_90_sent_at?: string | null
          scheduled_delete_at?: string
          updated_at?: string
          user_id?: string
          warned_at?: string
        }
        Relationships: []
      }
      admin_alert_cooldowns: {
        Row: {
          alert_key: string
          last_sent_at: string
          send_count: number
        }
        Insert: {
          alert_key: string
          last_sent_at?: string
          send_count?: number
        }
        Update: {
          alert_key?: string
          last_sent_at?: string
          send_count?: number
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          applicant_id: string | null
          cache_hits: number
          created_at: string
          criteria_count: number
          duration_ms: number | null
          employer_id: string | null
          fresh_calls: number
          function_name: string
          id: string
          job_id: string | null
          metadata: Json | null
          model: string | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          applicant_id?: string | null
          cache_hits?: number
          created_at?: string
          criteria_count?: number
          duration_ms?: number | null
          employer_id?: string | null
          fresh_calls?: number
          function_name: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
          model?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          applicant_id?: string | null
          cache_hits?: number
          created_at?: string
          criteria_count?: number
          duration_ms?: number | null
          employer_id?: string | null
          fresh_calls?: number
          function_name?: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
          model?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_exceptions: {
        Row: {
          created_at: string
          environment: string
          fingerprint: string
          first_seen_at: string
          http_status: number | null
          id: string
          kind: string
          last_seen_at: string
          message: string
          metadata: Json
          occurrence_count: number
          owner_user_id: string
          route: string
          severity: string
          source: string | null
          stacktrace: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          fingerprint: string
          first_seen_at?: string
          http_status?: number | null
          id?: string
          kind: string
          last_seen_at?: string
          message: string
          metadata?: Json
          occurrence_count?: number
          owner_user_id: string
          route?: string
          severity?: string
          source?: string | null
          stacktrace?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          fingerprint?: string
          first_seen_at?: string
          http_status?: number | null
          id?: string
          kind?: string
          last_seen_at?: string
          message?: string
          metadata?: Json
          occurrence_count?: number
          owner_user_id?: string
          route?: string
          severity?: string
          source?: string | null
          stacktrace?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      candidate_lists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          order_index: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          order_index?: number
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          order_index?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
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
          raw_text: string | null
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
          raw_text?: string | null
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
          raw_text?: string | null
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
          hidden_author_id: string | null
          id: string
          is_anonymous: boolean | null
          rating: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          company_id: string
          created_at?: string
          hidden_author_id?: string | null
          id?: string
          is_anonymous?: boolean | null
          rating: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          company_id?: string
          created_at?: string
          hidden_author_id?: string | null
          id?: string
          is_anonymous?: boolean | null
          rating?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          accepted_at: string
          consent_type: string
          created_at: string
          document_url: string | null
          document_version: string
          email: string | null
          id: string
          role: string | null
          source: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          created_at?: string
          document_url?: string | null
          document_version: string
          email?: string | null
          id?: string
          role?: string | null
          source?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          created_at?: string
          document_url?: string | null
          document_version?: string
          email?: string | null
          id?: string
          role?: string | null
          source?: string
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
      conversation_message_reactions: {
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
            foreignKeyName: "conversation_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_system_message: boolean
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_system_message?: boolean
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
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
          candidate_id: string | null
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
          candidate_id?: string | null
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
          candidate_id?: string | null
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
      criterion_feedback: {
        Row: {
          ai_result: string
          applicant_id: string
          corrected_result: string
          created_at: string
          criterion_id: string
          evaluation_id: string
          id: string
          job_id: string
          recruiter_id: string
          recruiter_note: string | null
        }
        Insert: {
          ai_result: string
          applicant_id: string
          corrected_result: string
          created_at?: string
          criterion_id: string
          evaluation_id: string
          id?: string
          job_id: string
          recruiter_id: string
          recruiter_note?: string | null
        }
        Update: {
          ai_result?: string
          applicant_id?: string
          corrected_result?: string
          created_at?: string
          criterion_id?: string
          evaluation_id?: string
          id?: string
          job_id?: string
          recruiter_id?: string
          recruiter_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criterion_feedback_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "job_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criterion_feedback_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "candidate_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criterion_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      criterion_prompt_embeddings: {
        Row: {
          created_at: string
          criterion_hash: string
          embedding: string
          id: string
          normalized_prompt: string
        }
        Insert: {
          created_at?: string
          criterion_hash: string
          embedding: string
          id?: string
          normalized_prompt: string
        }
        Update: {
          created_at?: string
          criterion_hash?: string
          embedding?: string
          id?: string
          normalized_prompt?: string
        }
        Relationships: []
      }
      criterion_results: {
        Row: {
          confidence: number | null
          context_hash: string | null
          created_at: string
          criterion_hash: string | null
          criterion_id: string
          evaluation_id: string
          id: string
          reasoning: string | null
          result: string
          source: string | null
        }
        Insert: {
          confidence?: number | null
          context_hash?: string | null
          created_at?: string
          criterion_hash?: string | null
          criterion_id: string
          evaluation_id: string
          id?: string
          reasoning?: string | null
          result: string
          source?: string | null
        }
        Update: {
          confidence?: number | null
          context_hash?: string | null
          created_at?: string
          criterion_hash?: string | null
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
      data_retention_runs: {
        Row: {
          deleted_count: number
          error_message: string | null
          id: string
          ran_at: string
          target_table: string
        }
        Insert: {
          deleted_count?: number
          error_message?: string | null
          id?: string
          ran_at?: string
          target_table: string
        }
        Update: {
          deleted_count?: number
          error_message?: string | null
          id?: string
          ran_at?: string
          target_table?: string
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employer_message_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          employer_id: string
          id: string
          is_default: boolean
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          employer_id: string
          id?: string
          is_default?: boolean
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          employer_id?: string
          id?: string
          is_default?: boolean
          order_index?: number
          title?: string
          updated_at?: string
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
          followup_reminder_sent_at: string | null
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
          followup_reminder_sent_at?: string | null
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
          followup_reminder_sent_at?: string | null
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
          questions_snapshot: Json | null
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
          questions_snapshot?: Json | null
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
          questions_snapshot?: Json | null
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
          auto_close_notified_at: string | null
          benefits: string[] | null
          category: string | null
          company_logo_url: string | null
          contact_email: string | null
          content_fingerprint: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_amount: number | null
          duration_unit: string | null
          employer_id: string
          employment_type: string | null
          expires_at: string | null
          id: string
          image_focus_position: string
          image_focus_position_card: string
          image_focus_position_desktop: string
          image_updated_at: string
          is_active: boolean | null
          job_image_card_url: string | null
          job_image_desktop_url: string | null
          job_image_url: string | null
          location: string | null
          occupation: string | null
          overlay_text_color: string
          part_time_days: string[] | null
          part_time_shifts: string[] | null
          pitch: string | null
          positions_count: number | null
          remote_work_possible: string | null
          removed_applicants_count: number
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          salary_transparency: string | null
          salary_type: string | null
          search_vector: unknown
          start_date: string | null
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
          auto_close_notified_at?: string | null
          benefits?: string[] | null
          category?: string | null
          company_logo_url?: string | null
          contact_email?: string | null
          content_fingerprint?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_amount?: number | null
          duration_unit?: string | null
          employer_id: string
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          image_focus_position?: string
          image_focus_position_card?: string
          image_focus_position_desktop?: string
          image_updated_at?: string
          is_active?: boolean | null
          job_image_card_url?: string | null
          job_image_desktop_url?: string | null
          job_image_url?: string | null
          location?: string | null
          occupation?: string | null
          overlay_text_color?: string
          part_time_days?: string[] | null
          part_time_shifts?: string[] | null
          pitch?: string | null
          positions_count?: number | null
          remote_work_possible?: string | null
          removed_applicants_count?: number
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_transparency?: string | null
          salary_type?: string | null
          search_vector?: unknown
          start_date?: string | null
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
          auto_close_notified_at?: string | null
          benefits?: string[] | null
          category?: string | null
          company_logo_url?: string | null
          contact_email?: string | null
          content_fingerprint?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_amount?: number | null
          duration_unit?: string | null
          employer_id?: string
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          image_focus_position?: string
          image_focus_position_card?: string
          image_focus_position_desktop?: string
          image_updated_at?: string
          is_active?: boolean | null
          job_image_card_url?: string | null
          job_image_desktop_url?: string | null
          job_image_url?: string | null
          location?: string | null
          occupation?: string | null
          overlay_text_color?: string
          part_time_days?: string[] | null
          part_time_shifts?: string[] | null
          pitch?: string | null
          positions_count?: number | null
          remote_work_possible?: string | null
          removed_applicants_count?: number
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_transparency?: string | null
          salary_type?: string | null
          search_vector?: unknown
          start_date?: string | null
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
          duration_amount: number | null
          duration_unit: string | null
          employer_id: string
          employment_type: string | null
          id: string
          is_default: boolean | null
          location: string | null
          name: string
          occupation: string | null
          part_time_days: string[] | null
          part_time_shifts: string[] | null
          pitch: string | null
          positions_count: string | null
          questions: Json | null
          remote_work_possible: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          salary_transparency: string | null
          salary_type: string | null
          start_date: string | null
          title: string
          updated_at: string
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
          benefits?: string[] | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          duration_amount?: number | null
          duration_unit?: string | null
          employer_id: string
          employment_type?: string | null
          id?: string
          is_default?: boolean | null
          location?: string | null
          name: string
          occupation?: string | null
          part_time_days?: string[] | null
          part_time_shifts?: string[] | null
          pitch?: string | null
          positions_count?: string | null
          questions?: Json | null
          remote_work_possible?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_transparency?: string | null
          salary_type?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
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
          benefits?: string[] | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          duration_amount?: number | null
          duration_unit?: string | null
          employer_id?: string
          employment_type?: string | null
          id?: string
          is_default?: boolean | null
          location?: string | null
          name?: string
          occupation?: string | null
          part_time_days?: string[] | null
          part_time_shifts?: string[] | null
          pitch?: string | null
          positions_count?: string | null
          questions?: Json | null
          remote_work_possible?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_transparency?: string | null
          salary_type?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
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
        Relationships: []
      }
      job_views: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          job_id: string
          os_type: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          job_id: string
          os_type?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          job_id?: string
          os_type?: string | null
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
      my_candidates: {
        Row: {
          applicant_id: string
          application_id: string
          created_at: string
          id: string
          job_id: string | null
          list_id: string | null
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
          list_id?: string | null
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
          list_id?: string | null
          notes?: string | null
          rating?: number | null
          recruiter_id?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "my_candidates_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "candidate_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          is_enabled: boolean
          notification_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          is_enabled?: boolean
          notification_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          is_enabled?: boolean
          notification_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      one_time_purchases: {
        Row: {
          activated_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          job_id: string | null
          metadata: Json
          organization_id: string | null
          price_sek: number
          purchased_at: string
          status: Database["public"]["Enums"]["plan_status"]
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json
          organization_id?: string | null
          price_sek?: number
          purchased_at?: string
          status?: Database["public"]["Enums"]["plan_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json
          organization_id?: string | null
          price_sek?: number
          purchased_at?: string
          status?: Database["public"]["Enums"]["plan_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_purchases_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_time_purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      outreach_automations: {
        Row: {
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at: string
          delay_minutes: number
          filters: Json
          id: string
          is_enabled: boolean
          name: string
          organization_id: string | null
          owner_user_id: string
          recipient_type: Database["public"]["Enums"]["outreach_recipient"]
          template_id: string
          trigger: Database["public"]["Enums"]["outreach_trigger"]
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          delay_minutes?: number
          filters?: Json
          id?: string
          is_enabled?: boolean
          name: string
          organization_id?: string | null
          owner_user_id: string
          recipient_type?: Database["public"]["Enums"]["outreach_recipient"]
          template_id: string
          trigger: Database["public"]["Enums"]["outreach_trigger"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          delay_minutes?: number
          filters?: Json
          id?: string
          is_enabled?: boolean
          name?: string
          organization_id?: string | null
          owner_user_id?: string
          recipient_type?: Database["public"]["Enums"]["outreach_recipient"]
          template_id?: string
          trigger?: Database["public"]["Enums"]["outreach_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "outreach_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_dispatch_logs: {
        Row: {
          automation_id: string | null
          channel: Database["public"]["Enums"]["outreach_channel"]
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          interview_id: string | null
          job_id: string | null
          organization_id: string | null
          owner_user_id: string
          payload: Json
          recipient_email: string | null
          recipient_user_id: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          trigger: Database["public"]["Enums"]["outreach_trigger"]
        }
        Insert: {
          automation_id?: string | null
          channel: Database["public"]["Enums"]["outreach_channel"]
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          interview_id?: string | null
          job_id?: string | null
          organization_id?: string | null
          owner_user_id: string
          payload?: Json
          recipient_email?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          trigger: Database["public"]["Enums"]["outreach_trigger"]
        }
        Update: {
          automation_id?: string | null
          channel?: Database["public"]["Enums"]["outreach_channel"]
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          interview_id?: string | null
          job_id?: string | null
          organization_id?: string | null
          owner_user_id?: string
          payload?: Json
          recipient_email?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          trigger?: Database["public"]["Enums"]["outreach_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "outreach_dispatch_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "outreach_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_dispatch_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_dispatch_logs_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_dispatch_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_dispatch_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_dispatch_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "outreach_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string | null
          owner_user_id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id?: string | null
          owner_user_id: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string | null
          owner_user_id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          raw_text: string | null
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
          raw_text?: string | null
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
          raw_text?: string | null
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
      profile_views: {
        Row: {
          application_id: string | null
          id: string
          job_id: string | null
          viewed_at: string
          viewed_user_id: string
          viewer_org_id: string | null
          viewer_user_id: string
        }
        Insert: {
          application_id?: string | null
          id?: string
          job_id?: string | null
          viewed_at?: string
          viewed_user_id: string
          viewer_org_id?: string | null
          viewer_user_id: string
        }
        Update: {
          application_id?: string | null
          id?: string
          job_id?: string | null
          viewed_at?: string
          viewed_user_id?: string
          viewer_org_id?: string | null
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_org_id_fkey"
            columns: ["viewer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          image_updated_at: string
          industry: string | null
          interests: string[] | null
          interview_default_message: string | null
          interview_office_address: string | null
          interview_office_instructions: string | null
          interview_video_default_message: string | null
          interview_video_link: string | null
          is_premium: boolean
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
          premium_until: string | null
          profile_file_name: string | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          social_media_links: Json | null
          updated_at: string
          user_id: string
          video_updated_at: string
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
          image_updated_at?: string
          industry?: string | null
          interests?: string[] | null
          interview_default_message?: string | null
          interview_office_address?: string | null
          interview_office_instructions?: string | null
          interview_video_default_message?: string | null
          interview_video_link?: string | null
          is_premium?: boolean
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
          premium_until?: string | null
          profile_file_name?: string | null
          profile_image_url?: string | null
          role: Database["public"]["Enums"]["user_role"]
          social_media_links?: Json | null
          updated_at?: string
          user_id: string
          video_updated_at?: string
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
          image_updated_at?: string
          industry?: string | null
          interests?: string[] | null
          interview_default_message?: string | null
          interview_office_address?: string | null
          interview_office_instructions?: string | null
          interview_video_default_message?: string | null
          interview_video_link?: string | null
          is_premium?: boolean
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
          premium_until?: string | null
          profile_file_name?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          social_media_links?: Json | null
          updated_at?: string
          user_id?: string
          video_updated_at?: string
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
      rate_limits: {
        Row: {
          bucket_key: string
          hits: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          hits?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          bucket_key?: string
          hits?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
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
          sort_by: string | null
          subcategories: string[] | null
          time_filter: string | null
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
          sort_by?: string | null
          subcategories?: string[] | null
          time_filter?: string | null
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
          sort_by?: string | null
          subcategories?: string[] | null
          time_filter?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          billing_period: Database["public"]["Enums"]["plan_billing_period"]
          created_at: string
          description: string | null
          features: Json
          id: string
          includes_candidate_bank: boolean
          is_active: boolean
          max_active_jobs: number | null
          max_users: number | null
          name: string
          price_sek: number
          sort_order: number
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          billing_period: Database["public"]["Enums"]["plan_billing_period"]
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          includes_candidate_bank?: boolean
          is_active?: boolean
          max_active_jobs?: number | null
          max_users?: number | null
          name: string
          price_sek: number
          sort_order?: number
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["plan_billing_period"]
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          includes_candidate_bank?: boolean
          is_active?: boolean
          max_active_jobs?: number | null
          max_users?: number | null
          name?: string
          price_sek?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      swipe_actions: {
        Row: {
          action: Database["public"]["Enums"]["swipe_action_type"]
          created_at: string
          id: string
          job_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["swipe_action_type"]
          created_at?: string
          id?: string
          job_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["swipe_action_type"]
          created_at?: string
          id?: string
          job_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipe_actions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
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
      user_onboarding_state: {
        Row: {
          coach_state: Json
          created_at: string
          tunnel_draft: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_state?: Json
          created_at?: string
          tunnel_draft?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_state?: Json
          created_at?: string
          tunnel_draft?: Json | null
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
      user_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          ip_address: string | null
          last_heartbeat_at: string
          revoked_at: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          last_heartbeat_at?: string
          revoked_at?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          last_heartbeat_at?: string
          revoked_at?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_stage_settings: {
        Row: {
          color: string | null
          created_at: string
          custom_label: string | null
          icon_name: string | null
          id: string
          is_custom: boolean
          list_id: string | null
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
          list_id?: string | null
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
          list_id?: string | null
          order_index?: number
          stage_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stage_settings_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "candidate_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          organization_id: string | null
          source: Database["public"]["Enums"]["plan_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["plan_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          source?: Database["public"]["Enums"]["plan_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          source?: Database["public"]["Enums"]["plan_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_reviews_public: {
        Row: {
          comment: string | null
          company_id: string | null
          created_at: string | null
          id: string | null
          is_anonymous: boolean | null
          rating: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          is_anonymous?: boolean | null
          rating?: number | null
          updated_at?: string | null
          user_id?: never
        }
        Update: {
          comment?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          is_anonymous?: boolean | null
          rating?: number | null
          updated_at?: string | null
          user_id?: never
        }
        Relationships: []
      }
    }
    Functions: {
      auth_email_registered: {
        Args: { _email: string }
        Returns: {
          exists_flag: boolean
          user_role: string
        }[]
      }
      can_employer_read_application_file: {
        Args: { p_name: string }
        Returns: boolean
      }
      can_manage_outreach_scope: {
        Args: { p_organization_id?: string; p_owner_user_id: string }
        Returns: boolean
      }
      can_view_job_application: { Args: { p_job_id: string }; Returns: boolean }
      claim_account_deletions: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          completed_at: string | null
          email: string | null
          last_error: string | null
          requested_at: string
          started_at: string | null
          status: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "account_deletion_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_admin_alert: {
        Args: { _alert_key: string; _cooldown_minutes?: number }
        Returns: boolean
      }
      cleanup_stale_sessions: { Args: never; Returns: number }
      complete_cv_analysis: {
        Args: {
          p_error_message?: string
          p_queue_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      compute_job_fingerprint: {
        Args: { j: Database["public"]["Tables"]["job_postings"]["Row"] }
        Returns: string
      }
      consume_rate_limit: {
        Args: { _key: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      count_distinct_candidates: {
        Args: { p_job_ids: string[] }
        Returns: number
      }
      count_distinct_my_candidates: {
        Args: { p_recruiter_id: string }
        Returns: number
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
      create_system_performance_alert: {
        Args: { _body: string; _metadata?: Json; _title: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_note_activities_for_applicant: {
        Args: { p_applicant_id: string }
        Returns: undefined
      }
      dispatch_interview_push: {
        Args: {
          p_body: string
          p_metadata: Json
          p_recipient_id: string
          p_title: string
        }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      employer_owns_job: { Args: { p_job_id: string }; Returns: boolean }
      employer_owns_job_for_question: {
        Args: { p_job_id: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_default_candidate_list: {
        Args: { p_owner_id: string }
        Returns: string
      }
      get_active_plan_details: {
        Args: { _user_id: string }
        Returns: {
          expires_at: string
          max_active_jobs: number
          max_users: number
          plan_name: string
          price_sek: number
          source_type: string
          status: Database["public"]["Enums"]["plan_status"]
          tier: Database["public"]["Enums"]["plan_tier"]
        }[]
      }
      get_active_sessions: {
        Args: never
        Returns: {
          created_at: string
          device_label: string
          id: string
          is_current: boolean
          last_heartbeat_at: string
          session_token: string
        }[]
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
          city: string
          image_updated_at: string
          is_profile_video: boolean
          last_active_at: string
          profile_image_url: string
          video_updated_at: string
          video_url: string
        }[]
      }
      get_application_quota: { Args: { p_user_id: string }; Returns: Json }
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
      get_conversation_summaries: {
        Args: { p_user_id: string }
        Returns: {
          conversation_id: string
          last_message_content: string
          last_message_created_at: string
          last_message_is_system: boolean
          last_message_sender_id: string
          unread_count: number
        }[]
      }
      get_cron_job_health: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          last_run_at: string
          last_status: string
          last_success_at: string
          schedule: string
        }[]
      }
      get_cron_recent_failures: {
        Args: { _hours?: number }
        Returns: {
          end_time: string
          jobid: number
          jobname: string
          return_message: string
          runid: number
          start_time: string
          status: string
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
      get_employer_advanced_analytics: {
        Args: { p_days_back?: number; p_user_id: string }
        Returns: Json
      }
      get_employer_analytics: { Args: { p_user_id: string }; Returns: Json }
      get_employer_analytics_v2: {
        Args: { p_days_back?: number; p_user_id: string }
        Returns: Json
      }
      get_employer_dashboard_stats:
        | { Args: { p_scope?: string }; Returns: Json }
        | {
            Args: { p_active_job_ids: string[]; p_user_id: string }
            Returns: Json
          }
      get_employer_jobs_counts: { Args: { p_scope?: string }; Returns: Json }
      get_employer_jobs_page: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_recruiter_id?: string
          p_scope?: string
          p_search?: string
          p_sort?: string
          p_status?: string
        }
        Returns: Json
      }
      get_employer_public_profile: {
        Args: { target_user_id: string }
        Returns: {
          address: string
          company_description: string
          company_logo_url: string
          company_name: string
          employee_count: string
          first_name: string
          industry: string
          last_name: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          website: string
        }[]
      }
      get_employer_public_profiles: {
        Args: { target_user_ids: string[] }
        Returns: {
          address: string
          company_description: string
          company_logo_url: string
          company_name: string
          employee_count: string
          first_name: string
          industry: string
          last_name: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          website: string
        }[]
      }
      get_jobseeker_dashboard_stats: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_my_profile: {
        Args: never
        Returns: {
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
          image_updated_at: string
          industry: string | null
          interests: string[] | null
          interview_default_message: string | null
          interview_office_address: string | null
          interview_office_instructions: string | null
          interview_video_default_message: string | null
          interview_video_link: string | null
          is_premium: boolean
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
          premium_until: string | null
          profile_file_name: string | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          social_media_links: Json | null
          updated_at: string
          user_id: string
          video_updated_at: string
          video_url: string | null
          website: string | null
          work_schedule: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_news_cron_health: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobname: string
          schedule: string
        }[]
      }
      get_outreach_automation_for_event: {
        Args: {
          p_channel: Database["public"]["Enums"]["outreach_channel"]
          p_owner_user_id: string
          p_trigger: Database["public"]["Enums"]["outreach_trigger"]
        }
        Returns: {
          automation_id: string
          body: string
          delay_minutes: number
          filters: Json
          recipient_type: Database["public"]["Enums"]["outreach_recipient"]
          subject: string
          template_id: string
        }[]
      }
      get_profile_view_stats: { Args: { p_user_id: string }; Returns: Json }
      get_user_organization_id: { Args: { p_user_id: string }; Returns: string }
      has_active_plan: { Args: { _user_id: string }; Returns: boolean }
      has_applied_to_employer: {
        Args: { p_applicant_id: string; p_employer_id: string }
        Returns: boolean
      }
      has_premium: { Args: { p_user_id: string }; Returns: boolean }
      heartbeat_session: { Args: { p_session_token: string }; Returns: boolean }
      increment_app_exception_count: {
        Args: { _fingerprint: string; _owner_user_id: string }
        Returns: undefined
      }
      increment_removed_applicants: {
        Args: { _counts: number[]; _job_ids: string[] }
        Returns: undefined
      }
      is_conversation_admin: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_email_notification_enabled: {
        Args: { p_email?: string; p_type?: string; p_user_id?: string }
        Returns: boolean
      }
      is_in_app_notification_enabled: {
        Args: { p_type: string; p_user_id: string }
        Returns: boolean
      }
      is_notification_enabled: {
        Args: { p_type: string; p_user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      is_session_valid: { Args: { p_session_token: string }; Returns: boolean }
      kick_session: { Args: { p_session_id: string }; Returns: boolean }
      log_profile_view: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      match_criterion_prompt: {
        Args: {
          match_context_hash: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          confidence: number
          criterion_hash: string
          reasoning: string
          result: string
          similarity: number
          source: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_job_text: { Args: { t: string }; Returns: string }
      parium_norm: { Args: { t: string }; Returns: string }
      purge_completed_deletion_rows: { Args: never; Returns: number }
      purge_old_email_dlq: { Args: never; Returns: number }
      purge_old_outreach_logs: { Args: never; Returns: number }
      purge_soft_deleted_jobs: {
        Args: never
        Returns: {
          image_url: string
          purged_job_id: string
        }[]
      }
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_app_exception: {
        Args: {
          _environment: string
          _fingerprint: string
          _http_status: number
          _kind: string
          _message: string
          _metadata?: Json
          _owner_user_id: string
          _route: string
          _severity: string
          _source: string
          _stacktrace: string
          _title: string
        }
        Returns: string
      }
      record_job_view:
        | {
            Args: {
              p_device_type?: string
              p_job_id: string
              p_user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_device_type?: string
              p_job_id: string
              p_os_type?: string
              p_user_id: string
            }
            Returns: boolean
          }
      register_session: {
        Args: {
          p_device_label: string
          p_ip_address?: string
          p_session_token: string
          p_user_agent?: string
        }
        Returns: Json
      }
      remove_session: { Args: { p_session_token: string }; Returns: undefined }
      render_outreach_template: {
        Args: { p_data?: Json; p_template: string }
        Returns: string
      }
      reorder_job_stages: {
        Args: { p_job_id: string; p_stage_keys: string[] }
        Returns: undefined
      }
      republish_job: {
        Args: { _days?: number; _job_id: string }
        Returns: string
      }
      requeue_missing_cv_analyses: {
        Args: { p_limit?: number }
        Returns: number
      }
      reregister_session: {
        Args: {
          p_device_label: string
          p_session_token: string
          p_user_agent?: string
        }
        Returns: Json
      }
      run_data_retention: { Args: never; Returns: undefined }
      same_organization: {
        Args: { p_user_id_1: string; p_user_id_2: string }
        Returns: boolean
      }
      search_employer_candidates: {
        Args: {
          p_count_cap?: number
          p_cursor_applied_at?: string
          p_cursor_id?: string
          p_filters?: Json
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_status?: string
          p_with_count?: boolean
        }
        Returns: {
          account_deleted: boolean
          age: number
          applicant_id: string
          applied_at: string
          availability: string
          bio: string
          custom_answers: Json
          cv_url: string
          email: string
          employment_status: string
          first_name: string
          id: string
          job_id: string
          job_occupation: string
          job_title: string
          last_name: string
          location: string
          match_source: string
          phone: string
          questions_snapshot: Json
          rating: number
          status: string
          total_count: number
          updated_at: string
          viewed_at: string
          work_schedule: string
        }[]
      }
      search_employer_jobs: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_recruiter_id?: string
          p_search?: string
          p_sort?: string
          p_status?: string
        }
        Returns: {
          job_id: string
          relevance: number
          total_count: number
        }[]
      }
      search_jobs: {
        Args: {
          p_category?: string
          p_city?: string
          p_county?: string
          p_created_after?: string
          p_cursor_created_at?: string
          p_employer_ids?: string[]
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
          company_logo_url: string
          contact_email: string
          created_at: string
          description: string
          duration_amount: number
          duration_unit: string
          employer_id: string
          employment_type: string
          expires_at: string
          id: string
          image_focus_position: string
          image_focus_position_desktop: string
          image_updated_at: string
          is_active: boolean
          job_image_desktop_url: string
          job_image_url: string
          location: string
          occupation: string
          overlay_text_color: string
          part_time_days: string[]
          part_time_shifts: string[]
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
      search_my_candidates:
        | {
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
        | {
            Args: {
              p_cursor_updated_at?: string
              p_limit?: number
              p_list_id?: string
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      switch_conversation_job_context: {
        Args: {
          p_conversation_id: string
          p_job_title: string
          p_new_application_id: string
          p_new_job_id: string
        }
        Returns: boolean
      }
      trigger_career_tips_fetch: { Args: never; Returns: undefined }
      trigger_cron_health_watchdog: { Args: never; Returns: undefined }
      trigger_hr_news_fetch: { Args: never; Returns: undefined }
      trigger_inactive_account_retention: { Args: never; Returns: undefined }
      trigger_news_health_watchdog: { Args: never; Returns: undefined }
      try_uuid: { Args: { p_text: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      verify_cron_secret: {
        Args: { _secret_name?: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      outreach_channel: "chat" | "email" | "push"
      outreach_recipient: "candidate" | "employer"
      outreach_trigger:
        | "job_closed"
        | "interview_scheduled"
        | "manual_send"
        | "application_received"
        | "application_no_response_14d"
        | "interview_before"
        | "interview_after"
      plan_billing_period: "monthly" | "one_time"
      plan_source: "stripe" | "manual" | "trial"
      plan_status: "active" | "expired" | "cancelled" | "pending"
      plan_tier: "one_time" | "start" | "vaxa" | "pro" | "jobseeker_premium"
      swipe_action_type: "skipped" | "liked" | "applied"
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
      outreach_channel: ["chat", "email", "push"],
      outreach_recipient: ["candidate", "employer"],
      outreach_trigger: [
        "job_closed",
        "interview_scheduled",
        "manual_send",
        "application_received",
        "application_no_response_14d",
        "interview_before",
        "interview_after",
      ],
      plan_billing_period: ["monthly", "one_time"],
      plan_source: ["stripe", "manual", "trial"],
      plan_status: ["active", "expired", "cancelled", "pending"],
      plan_tier: ["one_time", "start", "vaxa", "pro", "jobseeker_premium"],
      swipe_action_type: ["skipped", "liked", "applied"],
      user_role: ["job_seeker", "employer"],
    },
  },
} as const
