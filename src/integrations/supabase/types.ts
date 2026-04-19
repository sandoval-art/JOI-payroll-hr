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
      campaign_eod_recipients: {
        Row: {
          active: boolean
          campaign_id: string
          created_at: string
          email: string
          id: string
          role_label: string
        }
        Insert: {
          active?: boolean
          campaign_id: string
          created_at?: string
          email: string
          id?: string
          role_label: string
        }
        Update: {
          active?: boolean
          campaign_id?: string
          created_at?: string
          email?: string
          id?: string
          role_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_eod_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_eod_tl_notes: {
        Row: {
          campaign_id: string
          created_at: string
          date: string
          id: string
          note: string | null
          updated_at: string
          written_by: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          date: string
          id?: string
          note?: string | null
          updated_at?: string
          written_by?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          updated_at?: string
          written_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_eod_tl_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_eod_tl_notes_written_by_fkey"
            columns: ["written_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_eod_tl_notes_written_by_fkey"
            columns: ["written_by"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_kpi_config: {
        Row: {
          campaign_id: string
          display_order: number | null
          dropdown_options: string[] | null
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          min_target: number | null
        }
        Insert: {
          campaign_id: string
          display_order?: number | null
          dropdown_options?: string[] | null
          field_label: string
          field_name: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          min_target?: number | null
        }
        Update: {
          campaign_id?: string
          display_order?: number | null
          dropdown_options?: string[] | null
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          min_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_kpi_config_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          client_id: string
          created_at: string | null
          eod_digest_cutoff_time: string | null
          eod_digest_timezone: string
          id: string
          name: string
          team_lead_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          eod_digest_cutoff_time?: string | null
          eod_digest_timezone?: string
          id?: string
          name: string
          team_lead_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          eod_digest_cutoff_time?: string | null
          eod_digest_timezone?: string
          id?: string
          name?: string
          team_lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          bill_to_address: string | null
          bill_to_name: string | null
          created_at: string | null
          id: string
          name: string
          prefix: string
          subtitle: string | null
        }
        Insert: {
          bill_to_address?: string | null
          bill_to_name?: string | null
          created_at?: string | null
          id?: string
          name: string
          prefix: string
          subtitle?: string | null
        }
        Update: {
          bill_to_address?: string | null
          bill_to_name?: string | null
          created_at?: string | null
          id?: string
          name?: string
          prefix?: string
          subtitle?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          address: string | null
          bank_clabe: string | null
          campaign_id: string | null
          created_at: string | null
          curp: string | null
          daily_discount_rate: number | null
          email: string | null
          employee_id: string
          full_name: string
          id: string
          is_active: boolean | null
          kpi_bonus_amount: number | null
          monthly_base_salary: number | null
          phone: string | null
          reports_to: string | null
          rfc: string | null
          shift_type: string | null
          title: string
        }
        Insert: {
          address?: string | null
          bank_clabe?: string | null
          campaign_id?: string | null
          created_at?: string | null
          curp?: string | null
          daily_discount_rate?: number | null
          email?: string | null
          employee_id: string
          full_name: string
          id?: string
          is_active?: boolean | null
          kpi_bonus_amount?: number | null
          monthly_base_salary?: number | null
          phone?: string | null
          reports_to?: string | null
          rfc?: string | null
          shift_type?: string | null
          title?: string
        }
        Update: {
          address?: string | null
          bank_clabe?: string | null
          campaign_id?: string | null
          created_at?: string | null
          curp?: string | null
          daily_discount_rate?: number | null
          email?: string | null
          employee_id?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          kpi_bonus_amount?: number | null
          monthly_base_salary?: number | null
          phone?: string | null
          reports_to?: string | null
          rfc?: string | null
          shift_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
        ]
      }
      eod_logs: {
        Row: {
          campaign_id: string
          created_at: string | null
          date: string
          employee_id: string
          id: string
          metrics: Json
          notes: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          date: string
          employee_id: string
          id?: string
          metrics: Json
          notes?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          metrics?: Json
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eod_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eod_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eod_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          agent_name: string
          days_worked: number | null
          id: string
          invoice_id: string
          spiffs: number | null
          total: number | null
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          agent_name: string
          days_worked?: number | null
          id?: string
          invoice_id: string
          spiffs?: number | null
          total?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          agent_name?: string
          days_worked?: number | null
          id?: string
          invoice_id?: string
          spiffs?: number | null
          total?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string | null
          due_date: string
          id: string
          invoice_number: string
          status: string
          week_end: string
          week_number: number
          week_start: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          due_date: string
          id?: string
          invoice_number: string
          status?: string
          week_end: string
          week_number: number
          week_start: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          status?: string
          week_end?: string
          week_number?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mexican_holidays: {
        Row: {
          date: string
          name: string
        }
        Insert: {
          date: string
          name: string
        }
        Update: {
          date?: string
          name?: string
        }
        Relationships: []
      }
      payroll_periods: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          period_type: string
          start_date: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          period_type: string
          start_date: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          period_type?: string
          start_date?: string
          status?: string | null
        }
        Relationships: []
      }
      payroll_records: {
        Row: {
          additional_bonuses: number | null
          calculated_net_pay: number | null
          days_absent: number | null
          employee_id: string
          extra_days_count: number | null
          holiday_worked: boolean | null
          id: string
          kpi_achieved: boolean | null
          overrides_json: Json | null
          period_id: string
          sunday_premium_applied: boolean | null
          updated_at: string | null
        }
        Insert: {
          additional_bonuses?: number | null
          calculated_net_pay?: number | null
          days_absent?: number | null
          employee_id: string
          extra_days_count?: number | null
          holiday_worked?: boolean | null
          id?: string
          kpi_achieved?: boolean | null
          overrides_json?: Json | null
          period_id: string
          sunday_premium_applied?: boolean | null
          updated_at?: string | null
        }
        Update: {
          additional_bonuses?: number | null
          calculated_net_pay?: number | null
          days_absent?: number | null
          employee_id?: string
          extra_days_count?: number | null
          holiday_worked?: boolean | null
          id?: string
          kpi_achieved?: boolean | null
          overrides_json?: Json | null
          period_id?: string
          sunday_premium_applied?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      required_document_types: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_settings: {
        Row: {
          campaign_id: string
          days_of_week: number[] | null
          end_time: string
          grace_minutes: number | null
          id: string
          shift_name: string
          start_time: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          campaign_id: string
          days_of_week?: number[] | null
          end_time: string
          grace_minutes?: number | null
          id?: string
          shift_name: string
          start_time: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          campaign_id?: string
          days_of_week?: number[] | null
          end_time?: string
          grace_minutes?: number | null
          id?: string
          shift_name?: string
          start_time?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_settings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_settings_audit: {
        Row: {
          action: string
          campaign_id: string | null
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          changes: Json | null
          id: string
          shift_setting_id: string | null
        }
        Insert: {
          action: string
          campaign_id?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          changes?: Json | null
          id?: string
          shift_setting_id?: string | null
        }
        Update: {
          action?: string
          campaign_id?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          changes?: Json | null
          id?: string
          shift_setting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_settings_audit_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock: {
        Row: {
          auto_clocked_out: boolean
          break1_end: string | null
          break1_start: string | null
          break2_end: string | null
          break2_start: string | null
          clock_in: string
          clock_out: string | null
          created_at: string | null
          date: string
          employee_id: string
          eod_completed: boolean
          id: string
          is_late: boolean | null
          late_minutes: number | null
          lunch_end: string | null
          lunch_start: string | null
          shift_end_expected: string | null
          total_hours: number | null
        }
        Insert: {
          auto_clocked_out?: boolean
          break1_end?: string | null
          break1_start?: string | null
          break2_end?: string | null
          break2_start?: string | null
          clock_in: string
          clock_out?: string | null
          created_at?: string | null
          date: string
          employee_id: string
          eod_completed?: boolean
          id?: string
          is_late?: boolean | null
          late_minutes?: number | null
          lunch_end?: string | null
          lunch_start?: string | null
          shift_end_expected?: string | null
          total_hours?: number | null
        }
        Update: {
          auto_clocked_out?: boolean
          break1_end?: string | null
          break1_start?: string | null
          break2_end?: string | null
          break2_start?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string | null
          date?: string
          employee_id?: string
          eod_completed?: boolean
          id?: string
          is_late?: boolean | null
          late_minutes?: number | null
          lunch_end?: string | null
          lunch_start?: string | null
          shift_end_expected?: string | null
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clock_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_requests: {
        Row: {
          created_at: string | null
          employee_id: string
          end_date: string
          id: string
          notes: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          end_date: string
          id?: string
          notes?: string | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          employee_id: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          id: string
          role: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employees_no_pay: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          reports_to: string | null
          title: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          reports_to?: string | null
          title?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          reports_to?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "employees_no_pay"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_clockout_overdue: {
        Args: never
        Returns: {
          closed_id: string
          employee_id: string
          scheduled_end: string
        }[]
      }
      is_leadership: { Args: never; Returns: boolean }
      is_team_lead: { Args: never; Returns: boolean }
      my_employee_id: { Args: never; Returns: string }
      my_team_member_ids: { Args: never; Returns: string[] }
      my_tl_campaign_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
