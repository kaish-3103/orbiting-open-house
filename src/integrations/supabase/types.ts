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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      door_grants: {
        Row: {
          granted_at: string
          house_id: string
          room_key: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          house_id: string
          room_key: string
          user_id: string
        }
        Update: {
          granted_at?: string
          house_id?: string
          room_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "door_grants_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      house_activity: {
        Row: {
          cam: boolean
          house_id: string
          mic: boolean
          motion_id: string
          motion_ready_at: string
          path: Json
          room_key: string | null
          status: string
          updated_at: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          cam?: boolean
          house_id: string
          mic?: boolean
          motion_id?: string
          motion_ready_at?: string
          path?: Json
          room_key?: string | null
          status?: string
          updated_at?: string
          user_id: string
          x?: number
          y?: number
        }
        Update: {
          cam?: boolean
          house_id?: string
          mic?: boolean
          motion_id?: string
          motion_ready_at?: string
          path?: Json
          room_key?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "house_activity_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      house_invites: {
        Row: {
          created_at: string
          created_by: string
          house_id: string
          revoked: boolean
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          house_id: string
          revoked?: boolean
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          house_id?: string
          revoked?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_invites_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      house_knocks: {
        Row: {
          created_at: string
          decision: string
          house_id: string
          id: string
          owner_id: string
          room_key: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          decision?: string
          house_id: string
          id?: string
          owner_id: string
          room_key: string
          sender_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          house_id?: string
          id?: string
          owner_id?: string
          room_key?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_knocks_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      house_members: {
        Row: {
          color: string
          display_name: string
          house_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          color?: string
          display_name: string
          house_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          color?: string
          display_name?: string
          house_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_members_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          created_at: string
          created_by: string
          creation_request: string | null
          id: string
          name: string
          template: string
        }
        Insert: {
          created_at?: string
          created_by: string
          creation_request?: string | null
          id?: string
          name: string
          template?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          creation_request?: string | null
          id?: string
          name?: string
          template?: string
        }
        Relationships: []
      }
      room_doors: {
        Row: {
          house_id: string
          owner_id: string | null
          room_key: string
          state: string
        }
        Insert: {
          house_id: string
          owner_id?: string | null
          room_key: string
          state?: string
        }
        Update: {
          house_id?: string
          owner_id?: string | null
          room_key?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_doors_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_leases: {
        Row: {
          expires_at: string
          house_id: string
          id: string
          removed: boolean
          revoked: boolean
          room_key: string
          token_expires_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string
          house_id: string
          id?: string
          removed?: boolean
          revoked?: boolean
          room_key: string
          token_expires_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string
          house_id?: string
          id?: string
          removed?: boolean
          revoked?: boolean
          room_key?: string
          token_expires_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_leases_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_house: {
        Args: { _color: string; _display_name: string; _name: string }
        Returns: string
      }
      create_house_once: {
        Args: {
          _color: string
          _display_name: string
          _name: string
          _request_id: string
        }
        Returns: string
      }
      invite_preview: {
        Args: { _token: string }
        Returns: {
          house_id: string
          house_name: string
          member_count: number
        }[]
      }
      is_house_member: { Args: { _house: string }; Returns: boolean }
      join_house: {
        Args: { _color: string; _display_name: string; _token: string }
        Returns: string
      }
      orbit_access: {
        Args: { _house: string; _room: string; _user: string }
        Returns: boolean
      }
      orbit_action: {
        Args: { _action: string; _house: string; _payload?: Json }
        Returns: Json
      }
      orbit_room: { Args: { _x: number; _y: number }; Returns: string }
      orbit_voice: {
        Args: {
          _action: string
          _house: string
          _lease?: string
          _room?: string
        }
        Returns: Json
      }
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
    Enums: {},
  },
} as const
