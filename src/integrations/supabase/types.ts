export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
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
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      profiles: {
        Row: {
          bio: string | null
          company_name: string | null
          created_at: string
          cv_url: string | null
          first_name: string | null
          id: string
          last_name: string | null
          location: string | null
          org_number: string | null
          phone: string | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          bio?: string | null
          company_name?: string | null
          created_at?: string
          cv_url?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          location?: string | null
          org_number?: string | null
          phone?: string | null
          profile_image_url?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          bio?: string | null
          company_name?: string | null
          created_at?: string
          cv_url?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          location?: string | null
          org_number?: string | null
          phone?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
