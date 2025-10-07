// Generated types for Supabase database schema
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'user'
          plan: 'free' | 'pro' | 'enterprise'
          credits: number
          age_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'user'
          plan?: 'free' | 'pro' | 'enterprise'
          credits?: number
          age_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'user'
          plan?: 'free' | 'pro' | 'enterprise'
          credits?: number
          age_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          owner_id: string
          title: string
          status: 'pending' | 'processing' | 'ready' | 'failed'
          source_language: string
          target_language: string
          total_pages: number
          processed_pages: number
          content_rating: 'general' | 'teen' | 'mature' | 'explicit'
          rights_declaration: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          status?: 'pending' | 'processing' | 'ready' | 'failed'
          source_language?: string
          target_language?: string
          total_pages?: number
          processed_pages?: number
          content_rating?: 'general' | 'teen' | 'mature' | 'explicit'
          rights_declaration?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          status?: 'pending' | 'processing' | 'ready' | 'failed'
          source_language?: string
          target_language?: string
          total_pages?: number
          processed_pages?: number
          content_rating?: 'general' | 'teen' | 'mature' | 'explicit'
          rights_declaration?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      pages: {
        Row: {
          id: string
          project_id: string
          page_index: number
          width: number
          height: number
          original_blob_url: string
          processed_blob_url: string | null
          thumbnail_blob_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          page_index: number
          width: number
          height: number
          original_blob_url: string
          processed_blob_url?: string | null
          thumbnail_blob_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          page_index?: number
          width?: number
          height?: number
          original_blob_url?: string
          processed_blob_url?: string | null
          thumbnail_blob_url?: string | null
          created_at?: string
        }
      }
      text_blocks: {
        Row: {
          id: string
          page_id: string
          bbox: Json
          ocr_text: string | null
          translated_text: string | null
          confidence: number
          status: 'pending' | 'ocr_done' | 'translated' | 'reviewed' | 'flagged'
          font_family: string
          font_size: number
          text_align: string
          is_vertical: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          page_id: string
          bbox: Json
          ocr_text?: string | null
          translated_text?: string | null
          confidence?: number
          status?: 'pending' | 'ocr_done' | 'translated' | 'reviewed' | 'flagged'
          font_family?: string
          font_size?: number
          text_align?: string
          is_vertical?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          bbox?: Json
          ocr_text?: string | null
          translated_text?: string | null
          confidence?: number
          status?: 'pending' | 'ocr_done' | 'translated' | 'reviewed' | 'flagged'
          font_family?: string
          font_size?: number
          text_align?: string
          is_vertical?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          project_id: string
          job_type: 'ocr' | 'translate' | 'render' | 'export'
          state: 'pending' | 'running' | 'done' | 'failed'
          attempts: number
          max_attempts: number
          last_error: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          job_type: 'ocr' | 'translate' | 'render' | 'export'
          state?: 'pending' | 'running' | 'done' | 'failed'
          attempts?: number
          max_attempts?: number
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          job_type?: 'ocr' | 'translate' | 'render' | 'export'
          state?: 'pending' | 'running' | 'done' | 'failed'
          attempts?: number
          max_attempts?: number
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      review_items: {
        Row: {
          id: string
          text_block_id: string
          reason: 'low_conf' | 'policy_flag' | 'user_report'
          resolved: boolean
          reviewer_id: string | null
          reviewer_notes: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          text_block_id: string
          reason: 'low_conf' | 'policy_flag' | 'user_report'
          resolved?: boolean
          reviewer_id?: string | null
          reviewer_notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          text_block_id?: string
          reason?: 'low_conf' | 'policy_flag' | 'user_report'
          resolved?: boolean
          reviewer_id?: string | null
          reviewer_notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
      }
      billing_usage: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          tokens: number
          pages: number
          amount_cents: number
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          tokens?: number
          pages?: number
          amount_cents?: number
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          tokens?: number
          pages?: number
          amount_cents?: number
          description?: string | null
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          reporter_id: string | null
          project_id: string | null
          reason: string
          description: string | null
          status: 'pending' | 'reviewing' | 'resolved' | 'dismissed'
          resolved_by: string | null
          resolution_notes: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          reporter_id?: string | null
          project_id?: string | null
          reason: string
          description?: string | null
          status?: 'pending' | 'reviewing' | 'resolved' | 'dismissed'
          resolved_by?: string | null
          resolution_notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          reporter_id?: string | null
          project_id?: string | null
          reason?: string
          description?: string | null
          status?: 'pending' | 'reviewing' | 'resolved' | 'dismissed'
          resolved_by?: string | null
          resolution_notes?: string | null
          created_at?: string
          resolved_at?: string | null
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Page = Database['public']['Tables']['pages']['Row']
export type TextBlock = Database['public']['Tables']['text_blocks']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type ReviewItem = Database['public']['Tables']['review_items']['Row']
export type BillingUsage = Database['public']['Tables']['billing_usage']['Row']
export type Report = Database['public']['Tables']['reports']['Row']

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}
