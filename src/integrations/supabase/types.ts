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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          phone_number: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone_number?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phone_number?: string | null
          user_id?: string
        }
        Relationships: []
      }
      project_frames: {
        Row: {
          created_at: string
          dialogues: Json
          duration: number | null
          frame_number: number
          id: string
          image_path: string | null
          narration: string | null
          project_id: string
          scene_description: string | null
          shot_breakdown: Json | null
          text_overlays: Json | null
        }
        Insert: {
          created_at?: string
          dialogues?: Json
          duration?: number | null
          frame_number: number
          id?: string
          image_path?: string | null
          narration?: string | null
          project_id: string
          scene_description?: string | null
          shot_breakdown?: Json | null
          text_overlays?: Json | null
        }
        Update: {
          created_at?: string
          dialogues?: Json
          duration?: number | null
          frame_number?: number
          id?: string
          image_path?: string | null
          narration?: string | null
          project_id?: string
          scene_description?: string | null
          shot_breakdown?: Json | null
          text_overlays?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_frames_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "story_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_videos: {
        Row: {
          created_at: string
          frame_number: number | null
          id: string
          project_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          frame_number?: number | null
          id?: string
          project_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          frame_number?: number | null
          id?: string
          project_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "story_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_characters: {
        Row: {
          created_at: string
          features: string | null
          id: string
          image_url: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          features?: string | null
          id?: string
          image_url?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          features?: string | null
          id?: string
          image_url?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_objects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      story_projects: {
        Row: {
          created_at: string
          folder_id: string | null
          frame_count: number | null
          id: string
          image_format: string | null
          is_public: boolean
          story_language: string | null
          story_mode: string | null
          story_topic: string | null
          style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          frame_count?: number | null
          id?: string
          image_format?: string | null
          is_public?: boolean
          story_language?: string | null
          story_mode?: string | null
          story_topic?: string | null
          style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          frame_count?: number | null
          id?: string
          image_format?: string | null
          is_public?: boolean
          story_language?: string | null
          story_mode?: string | null
          story_topic?: string | null
          style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_story_projects_folder"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "story_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      story_templates: {
        Row: {
          art_style: string | null
          character_ids: Json | null
          created_at: string
          frame_count: number | null
          frame_prompts: Json | null
          id: string
          image_format: string | null
          name: string
          object_ids: Json | null
          per_frame_mode: boolean | null
          story_language: string | null
          story_topic: string | null
          use_character_avatars: boolean | null
          user_id: string
        }
        Insert: {
          art_style?: string | null
          character_ids?: Json | null
          created_at?: string
          frame_count?: number | null
          frame_prompts?: Json | null
          id?: string
          image_format?: string | null
          name: string
          object_ids?: Json | null
          per_frame_mode?: boolean | null
          story_language?: string | null
          story_topic?: string | null
          use_character_avatars?: boolean | null
          user_id: string
        }
        Update: {
          art_style?: string | null
          character_ids?: Json | null
          created_at?: string
          frame_count?: number | null
          frame_prompts?: Json | null
          id?: string
          image_format?: string | null
          name?: string
          object_ids?: Json | null
          per_frame_mode?: boolean | null
          story_language?: string | null
          story_topic?: string | null
          use_character_avatars?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          created_at: string
          credits: number
          id: string
          is_unlimited: boolean
          plan: string
          plan_expires_at: string | null
          plan_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          is_unlimited?: boolean
          plan?: string
          plan_expires_at?: string | null
          plan_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          is_unlimited?: boolean
          plan?: string
          plan_expires_at?: string | null
          plan_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
