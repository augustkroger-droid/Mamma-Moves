export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          email: string | null;
          has_seen_intro: boolean;
          intro_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          email?: string | null;
          has_seen_intro?: boolean;
          intro_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          email?: string | null;
          has_seen_intro?: boolean;
          intro_seen_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          youtube_video_id: string | null;
          video_url: string | null;
          video_provider: "youtube" | "instagram" | "facebook" | "external" | "none";
          thumbnail_url: string | null;
          category: string | null;
          categories: string[];
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          youtube_video_id?: string | null;
          video_url?: string | null;
          video_provider?: "youtube" | "instagram" | "facebook" | "external" | "none";
          thumbnail_url?: string | null;
          category?: string | null;
          categories?: string[];
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          youtube_video_id?: string | null;
          video_url?: string | null;
          video_provider?: "youtube" | "instagram" | "facebook" | "external" | "none";
          thumbnail_url?: string | null;
          category?: string | null;
          categories?: string[];
          active?: boolean;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          thumbnail_url: string | null;
          category: string | null;
          active: boolean;
          created_by: string | null;
          visibility: "all" | "selected" | "private";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          thumbnail_url?: string | null;
          category?: string | null;
          active?: boolean;
          created_by?: string | null;
          visibility?: "all" | "selected" | "private";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          thumbnail_url?: string | null;
          category?: string | null;
          active?: boolean;
          created_by?: string | null;
          visibility?: "all" | "selected" | "private";
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_template_exercises: {
        Row: {
          workout_template_id: string;
          exercise_id: string;
          position: number;
        };
        Insert: {
          workout_template_id: string;
          exercise_id: string;
          position: number;
        };
        Update: {
          position?: number;
        };
        Relationships: [];
      };
      workout_template_archives: {
        Row: {
          user_id: string;
          workout_template_id: string;
          archived_at: string;
          deleted_at: string | null;
        };
        Insert: {
          user_id: string;
          workout_template_id: string;
          archived_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          archived_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      workout_template_access: {
        Row: {
          workout_template_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          workout_template_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          workout_template_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          workout_template_id: string | null;
          started_at: string;
          completed_at: string | null;
          duration_seconds: number;
          status: "started" | "paused" | "completed" | "abandoned";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_template_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          duration_seconds?: number;
          status?: "started" | "paused" | "completed" | "abandoned";
          created_at?: string;
        };
        Update: {
          completed_at?: string | null;
          duration_seconds?: number;
          status?: "started" | "paused" | "completed" | "abandoned";
        };
        Relationships: [];
      };
      workout_session_exercises: {
        Row: {
          id: string;
          workout_session_id: string;
          exercise_id: string;
          position: number;
          completed: boolean;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          workout_session_id: string;
          exercise_id: string;
          position: number;
          completed?: boolean;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          completed?: boolean;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      streak_pauses: {
        Row: {
          id: string;
          user_id: string;
          start_date: string;
          end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_date: string;
          end_date: string;
          created_at?: string;
        };
        Update: {
          start_date?: string;
          end_date?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          daily_streak_enabled: boolean;
          reminder_time: string;
          last_daily_streak_reminder_date: string | null;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          daily_streak_enabled?: boolean;
          reminder_time?: string;
          last_daily_streak_reminder_date?: string | null;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          daily_streak_enabled?: boolean;
          reminder_time?: string;
          last_daily_streak_reminder_date?: string | null;
          last_seen_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
