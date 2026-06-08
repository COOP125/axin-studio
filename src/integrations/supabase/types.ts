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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          course_type: Database["public"]["Enums"]["course_type"]
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          is_trial: boolean
          note: string | null
          slot_date: string
          slot_hour: number
          user_id: string | null
        }
        Insert: {
          course_type: Database["public"]["Enums"]["course_type"]
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          is_trial?: boolean
          note?: string | null
          slot_date: string
          slot_hour: number
          user_id?: string | null
        }
        Update: {
          course_type?: Database["public"]["Enums"]["course_type"]
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          is_trial?: boolean
          note?: string | null
          slot_date?: string
          slot_hour?: number
          user_id?: string | null
        }
        Relationships: []
      }
      class_schedules: {
        Row: {
          coach_id: string | null
          course_type: Database["public"]["Enums"]["course_type"]
          created_at: string
          id: string
          is_active: boolean
          slot_hour: number
          updated_at: string
          weekday: number
        }
        Insert: {
          coach_id?: string | null
          course_type: Database["public"]["Enums"]["course_type"]
          created_at?: string
          id?: string
          is_active?: boolean
          slot_hour: number
          updated_at?: string
          weekday: number
        }
        Update: {
          coach_id?: string | null
          course_type?: Database["public"]["Enums"]["course_type"]
          created_at?: string
          id?: string
          is_active?: boolean
          slot_hour?: number
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          course_type: Database["public"]["Enums"]["course_type"]
          created_at: string
          delta: number
          id: string
          operator_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          course_type: Database["public"]["Enums"]["course_type"]
          created_at?: string
          delta: number
          id?: string
          operator_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          course_type?: Database["public"]["Enums"]["course_type"]
          created_at?: string
          delta?: number
          id?: string
          operator_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      member_credits: {
        Row: {
          course_type: Database["public"]["Enums"]["course_type"]
          remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          course_type: Database["public"]["Enums"]["course_type"]
          remaining?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          course_type?: Database["public"]["Enums"]["course_type"]
          remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_otp: {
        Row: {
          attempts: number
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          attempts?: number
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          attempts?: number
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          coach_id: string | null
          created_at: string
          display_name: string | null
          nickname: string | null
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          coach_id?: string | null
          created_at?: string
          display_name?: string | null
          nickname?: string | null
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          coach_id?: string | null
          created_at?: string
          display_name?: string | null
          nickname?: string | null
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          course_type: Database["public"]["Enums"]["course_type"]
          created_at: string
          id: string
          note: string | null
          quantity: number
          resolved_at: string | null
          resolved_by: string | null
          status: string
          unit_price: number
          user_id: string
        }
        Insert: {
          course_type: Database["public"]["Enums"]["course_type"]
          created_at?: string
          id?: string
          note?: string | null
          quantity: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          unit_price: number
          user_id: string
        }
        Update: {
          course_type?: Database["public"]["Enums"]["course_type"]
          created_at?: string
          id?: string
          note?: string | null
          quantity?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      course_capacity: {
        Args: { ct: Database["public"]["Enums"]["course_type"] }
        Returns: number
      }
      get_slot_counts: {
        Args: { end_date: string; start_date: string }
        Returns: {
          booked: number
          slot_date: string
          slot_hour: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member" | "coach"
      course_type: "private" | "student" | "group" | "cardio"
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
      app_role: ["admin", "member", "coach"],
      course_type: ["private", "student", "group", "cardio"],
    },
  },
} as const
