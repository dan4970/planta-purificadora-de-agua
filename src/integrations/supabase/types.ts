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
      alarm_thresholds: {
        Row: {
          acceptable_max: number
          alert_max: number
          created_at: string
          good_max: number
          id: string
          iso_class: string
          measurement_point_id: string
          temperature_max: number
        }
        Insert: {
          acceptable_max?: number
          alert_max?: number
          created_at?: string
          good_max?: number
          id?: string
          iso_class?: string
          measurement_point_id: string
          temperature_max?: number
        }
        Update: {
          acceptable_max?: number
          alert_max?: number
          created_at?: string
          good_max?: number
          id?: string
          iso_class?: string
          measurement_point_id?: string
          temperature_max?: number
        }
        Relationships: [
          {
            foreignKeyName: "alarm_thresholds_measurement_point_id_fkey"
            columns: ["measurement_point_id"]
            isOneToOne: true
            referencedRelation: "measurement_points"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          area: string
          code: string
          created_at: string
          criticality: Database["public"]["Enums"]["criticality_level"]
          id: string
          location: string | null
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
          service_hours: number
          status: Database["public"]["Enums"]["asset_status"]
        }
        Insert: {
          area: string
          code: string
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          id?: string
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
          service_hours?: number
          status?: Database["public"]["Enums"]["asset_status"]
        }
        Update: {
          area?: string
          code?: string
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          id?: string
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
          service_hours?: number
          status?: Database["public"]["Enums"]["asset_status"]
        }
        Relationships: []
      }
      diagnoses: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string | null
          fault_type: string
          findings: string | null
          id: string
          measurement_point_id: string | null
          recommendation: string | null
          severity: Database["public"]["Enums"]["severity_level"]
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by?: string | null
          fault_type: string
          findings?: string | null
          id?: string
          measurement_point_id?: string | null
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string | null
          fault_type?: string
          findings?: string | null
          id?: string
          measurement_point_id?: string | null
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
        }
        Relationships: [
          {
            foreignKeyName: "diagnoses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_measurement_point_id_fkey"
            columns: ["measurement_point_id"]
            isOneToOne: false
            referencedRelation: "measurement_points"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_tokens: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string
          token_hash: string
          token_prefix: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          token_hash: string
          token_prefix: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          token_hash?: string
          token_prefix?: string
        }
        Relationships: []
      }
      measurement_points: {
        Row: {
          asset_id: string
          code: string
          created_at: string
          direction: string | null
          id: string
          name: string
          position: string | null
          sensor_id: string | null
        }
        Insert: {
          asset_id: string
          code: string
          created_at?: string
          direction?: string | null
          id?: string
          name: string
          position?: string | null
          sensor_id?: string | null
        }
        Update: {
          asset_id?: string
          code?: string
          created_at?: string
          direction?: string | null
          id?: string
          name?: string
          position?: string | null
          sensor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_points_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_executions: {
        Row: {
          checklist_result: Json
          created_at: string
          executed_at: string
          executed_by: string | null
          hours_spent: number
          id: string
          notes: string | null
          pm_plan_id: string
        }
        Insert: {
          checklist_result?: Json
          created_at?: string
          executed_at?: string
          executed_by?: string | null
          hours_spent?: number
          id?: string
          notes?: string | null
          pm_plan_id: string
        }
        Update: {
          checklist_result?: Json
          created_at?: string
          executed_at?: string
          executed_by?: string | null
          hours_spent?: number
          id?: string
          notes?: string | null
          pm_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_executions_pm_plan_id_fkey"
            columns: ["pm_plan_id"]
            isOneToOne: false
            referencedRelation: "pm_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_plans: {
        Row: {
          active: boolean
          asset_id: string
          checklist: Json
          created_at: string
          description: string | null
          estimated_hours: number
          frequency_type: Database["public"]["Enums"]["freq_type"]
          frequency_value: number
          id: string
          last_done_at: string | null
          name: string
          next_due_at: string
        }
        Insert: {
          active?: boolean
          asset_id: string
          checklist?: Json
          created_at?: string
          description?: string | null
          estimated_hours?: number
          frequency_type?: Database["public"]["Enums"]["freq_type"]
          frequency_value?: number
          id?: string
          last_done_at?: string | null
          name: string
          next_due_at?: string
        }
        Update: {
          active?: boolean
          asset_id?: string
          checklist?: Json
          created_at?: string
          description?: string | null
          estimated_hours?: number
          frequency_type?: Database["public"]["Enums"]["freq_type"]
          frequency_value?: number
          id?: string
          last_done_at?: string | null
          name?: string
          next_due_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_plans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
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
      vibration_readings: {
        Row: {
          acceleration_rms: number | null
          created_at: string
          created_by: string | null
          id: string
          measured_at: string
          measurement_point_id: string
          rpm: number | null
          severity: Database["public"]["Enums"]["severity_level"]
          source: string
          temperature_c: number | null
          velocity_rms: number
        }
        Insert: {
          acceleration_rms?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          measured_at?: string
          measurement_point_id: string
          rpm?: number | null
          severity?: Database["public"]["Enums"]["severity_level"]
          source?: string
          temperature_c?: number | null
          velocity_rms: number
        }
        Update: {
          acceleration_rms?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          measured_at?: string
          measurement_point_id?: string
          rpm?: number | null
          severity?: Database["public"]["Enums"]["severity_level"]
          source?: string
          temperature_c?: number | null
          velocity_rms?: number
        }
        Relationships: [
          {
            foreignKeyName: "vibration_readings_measurement_point_id_fkey"
            columns: ["measurement_point_id"]
            isOneToOne: false
            referencedRelation: "measurement_points"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_parts: {
        Row: {
          created_at: string
          id: string
          part_name: string
          quantity: number
          unit_cost: number
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          part_name: string
          quantity?: number
          unit_cost?: number
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          part_name?: string
          quantity?: number
          unit_cost?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_parts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          asset_id: string
          assigned_to: string | null
          closed_at: string | null
          cost: number
          created_at: string
          created_by: string | null
          description: string | null
          downtime_hours: number
          due_date: string | null
          id: string
          labor_hours: number
          opened_at: string
          priority: Database["public"]["Enums"]["wo_priority"]
          root_cause: string | null
          status: Database["public"]["Enums"]["wo_status"]
          symptom: string | null
          title: string
          type: Database["public"]["Enums"]["wo_type"]
          wo_number: number
          work_done: string | null
        }
        Insert: {
          asset_id: string
          assigned_to?: string | null
          closed_at?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          downtime_hours?: number
          due_date?: string | null
          id?: string
          labor_hours?: number
          opened_at?: string
          priority?: Database["public"]["Enums"]["wo_priority"]
          root_cause?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          symptom?: string | null
          title: string
          type?: Database["public"]["Enums"]["wo_type"]
          wo_number?: never
          work_done?: string | null
        }
        Update: {
          asset_id?: string
          assigned_to?: string | null
          closed_at?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          downtime_hours?: number
          due_date?: string | null
          id?: string
          labor_hours?: number
          opened_at?: string
          priority?: Database["public"]["Enums"]["wo_priority"]
          root_cause?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          symptom?: string | null
          title?: string
          type?: Database["public"]["Enums"]["wo_type"]
          wo_number?: never
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "tecnico"
      asset_status: "operativo" | "alarma" | "mantenimiento" | "detenido"
      criticality_level: "critico" | "importante" | "general"
      freq_type: "dias" | "horas"
      severity_level: "bueno" | "aceptable" | "alerta" | "peligro"
      wo_priority: "baja" | "media" | "alta" | "urgente"
      wo_status:
        | "abierta"
        | "en_proceso"
        | "espera_repuesto"
        | "cerrada"
        | "cancelada"
      wo_type: "correctivo" | "preventivo" | "predictivo"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "supervisor", "tecnico"],
      asset_status: ["operativo", "alarma", "mantenimiento", "detenido"],
      criticality_level: ["critico", "importante", "general"],
      freq_type: ["dias", "horas"],
      severity_level: ["bueno", "aceptable", "alerta", "peligro"],
      wo_priority: ["baja", "media", "alta", "urgente"],
      wo_status: [
        "abierta",
        "en_proceso",
        "espera_repuesto",
        "cerrada",
        "cancelada",
      ],
      wo_type: ["correctivo", "preventivo", "predictivo"],
    },
  },
} as const
