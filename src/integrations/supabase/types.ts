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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      email_confirmations: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          pin_attempts: number | null
          pin_code: string | null
          pin_expires_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          pin_attempts?: number | null
          pin_code?: string | null
          pin_expires_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          pin_attempts?: number | null
          pin_code?: string | null
          pin_expires_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          application_instructions: string | null
          applications_count: number
          category: string | null
          contact_email: string | null
          created_at: string
          description: string
          employer_id: string
          employment_type: string | null
          id: string
          is_active: boolean
          location: string
          organization_id: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          title: string
          updated_at: string
          views_count: number
          work_schedule: string | null
        }
        Insert: {
          application_instructions?: string | null
          applications_count?: number
          category?: string | null
          contact_email?: string | null
          created_at?: string
          description: string
          employer_id: string
          employment_type?: string | null
          id?: string
          is_active?: boolean
          location: string
          organization_id?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title: string
          updated_at?: string
          views_count?: number
          work_schedule?: string | null
        }
        Update: {
          application_instructions?: string | null
          applications_count?: number
          category?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string
          employer_id?: string
          employment_type?: string | null
          id?: string
          is_active?: boolean
          location?: string
          organization_id?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title?: string
          updated_at?: string
          views_count?: number
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_profile_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_postings_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_postings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          job_id: string
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          job_id: string
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          job_id?: string
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
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
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          max_recruiters: number | null
          name: string
          org_number: string | null
          subscription_plan: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_recruiters?: number | null
          name: string
          org_number?: string | null
          subscription_plan?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_recruiters?: number | null
          name?: string
          org_number?: string | null
          subscription_plan?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      Parium: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      profile_view_permissions: {
        Row: {
          created_at: string
          employer_id: string
          expires_at: string | null
          granted_at: string
          id: string
          is_active: boolean
          job_posting_id: string | null
          job_seeker_id: string
          permission_type: string
        }
        Insert: {
          created_at?: string
          employer_id: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          is_active?: boolean
          job_posting_id?: string | null
          job_seeker_id: string
          permission_type?: string
        }
        Update: {
          created_at?: string
          employer_id?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          is_active?: boolean
          job_posting_id?: string | null
          job_seeker_id?: string
          permission_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_view_permissions_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability: string | null
          bio: string | null
          birth_date: string | null
          company_name: string | null
          created_at: string
          cv_url: string | null
          employment_status: string | null
          first_name: string | null
          home_location: string | null
          id: string
          interests: Json | null
          last_name: string | null
          location: string | null
          onboarding_completed: boolean
          org_number: string | null
          organization_id: string | null
          phone: string | null
          postal_code: string | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
          video_url: string | null
          working_hours: string | null
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          birth_date?: string | null
          company_name?: string | null
          created_at?: string
          cv_url?: string | null
          employment_status?: string | null
          first_name?: string | null
          home_location?: string | null
          id?: string
          interests?: Json | null
          last_name?: string | null
          location?: string | null
          onboarding_completed?: boolean
          org_number?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_image_url?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
          video_url?: string | null
          working_hours?: string | null
        }
        Update: {
          availability?: string | null
          bio?: string | null
          birth_date?: string | null
          company_name?: string | null
          created_at?: string
          cv_url?: string | null
          employment_status?: string | null
          first_name?: string | null
          home_location?: string | null
          id?: string
          interests?: Json | null
          last_name?: string | null
          location?: string | null
          onboarding_completed?: boolean
          org_number?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
          video_url?: string | null
          working_hours?: string | null
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
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
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
      employer_profile_view: {
        Row: {
          availability: string | null
          bio: string | null
          created_at: string | null
          cv_url: string | null
          employment_status: string | null
          first_name: string | null
          home_location: string | null
          id: string | null
          interests: Json | null
          last_name: string | null
          onboarding_completed: boolean | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          user_id: string | null
          video_url: string | null
          working_hours: string | null
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          created_at?: string | null
          cv_url?: string | null
          employment_status?: string | null
          first_name?: string | null
          home_location?: string | null
          id?: string | null
          interests?: Json | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
          working_hours?: string | null
        }
        Update: {
          availability?: string | null
          bio?: string | null
          created_at?: string | null
          cv_url?: string | null
          employment_status?: string | null
          first_name?: string | null
          home_location?: string | null
          id?: string | null
          interests?: Json | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
          working_hours?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_age: {
        Args: { birth_date: string }
        Returns: number
      }
      can_access_confirmation_data: {
        Args: { confirmation_user_id: string }
        Returns: boolean
      }
      can_view_job_seeker_profile: {
        Args: { employer_uuid: string; seeker_uuid: string }
        Returns: boolean
      }
      cleanup_expired_confirmations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_secure_confirmation_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_organization: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_user_role: {
        Args: { org_uuid?: string; user_uuid: string }
        Returns: string
      }
      is_super_admin: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      test_reset_flow: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      validate_file_upload: {
        Args: { content_type: string; file_name: string; file_size: number }
        Returns: boolean
      }
      validate_profile_data: {
        Args: { birth_date: string; cv_url: string; phone: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role:
        | "super_admin"
        | "company_admin"
        | "recruiter"
        | "job_seeker"
        | "employer"
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
      user_role: [
        "super_admin",
        "company_admin",
        "recruiter",
        "job_seeker",
        "employer",
      ],
    },
  },
} as const
