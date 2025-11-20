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
      job_applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          applications_count: number | null
          created_at: string
          description: string | null
          employer_id: string
          employment_type: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          job_image_url: string | null
          location: string | null
          occupation: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          title: string
          updated_at: string
          views_count: number | null
          work_schedule: string | null
        }
        Insert: {
          applications_count?: number | null
          created_at?: string
          description?: string | null
          employer_id: string
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          job_image_url?: string | null
          location?: string | null
          occupation?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title: string
          updated_at?: string
          views_count?: number | null
          work_schedule?: string | null
        }
        Update: {
          applications_count?: number | null
          created_at?: string
          description?: string | null
          employer_id?: string
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          job_image_url?: string | null
          location?: string | null
          occupation?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title?: string
          updated_at?: string
          views_count?: number | null
          work_schedule?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      job_templates: {
        Row: {
          created_at: string
          description: string | null
          employer_id: string
          employment_type: string | null
          id: string
          is_default: boolean | null
          location: string | null
          name: string
          occupation: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          title: string
          updated_at: string
          work_schedule: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          employer_id: string
          employment_type?: string | null
          id?: string
          is_default?: boolean | null
          location?: string | null
          name: string
          occupation?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title: string
          updated_at?: string
          work_schedule?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          employer_id?: string
          employment_type?: string | null
          id?: string
          is_default?: boolean | null
          location?: string | null
          name?: string
          occupation?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title?: string
          updated_at?: string
          work_schedule?: string | null
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
          availability: string | null
          bio: string | null
          birth_date: string | null
          city: string | null
          company_description: string | null
          company_logo_url: string | null
          company_name: string | null
          cover_image_url: string | null
          created_at: string
          cv_url: string | null
          email: string | null
          employment_type: string | null
          first_name: string | null
          home_location: string | null
          id: string
          industry: string | null
          interests: string[] | null
          is_profile_video: boolean | null
          last_name: string | null
          location: string | null
          not_currently_looking: boolean | null
          occupation: string | null
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
          availability?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          company_description?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          employment_type?: string | null
          first_name?: string | null
          home_location?: string | null
          id?: string
          industry?: string | null
          interests?: string[] | null
          is_profile_video?: boolean | null
          last_name?: string | null
          location?: string | null
          not_currently_looking?: boolean | null
          occupation?: string | null
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
          availability?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          company_description?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          employment_type?: string | null
          first_name?: string | null
          home_location?: string | null
          id?: string
          industry?: string | null
          interests?: string[] | null
          is_profile_video?: boolean | null
          last_name?: string | null
          location?: string | null
          not_currently_looking?: boolean | null
          occupation?: string | null
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
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string | null
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string | null
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
