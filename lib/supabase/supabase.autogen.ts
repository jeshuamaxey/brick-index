export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
  pipeline: {
    Tables: {
      jobs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          listings_found: number | null
          listings_new: number | null
          listings_updated: number | null
          marketplace: string
          metadata: Json | null
          started_at: string | null
          status: string
          type: Database["pipeline"]["Enums"]["job_type"]
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          listings_found?: number | null
          listings_new?: number | null
          listings_updated?: number | null
          marketplace: string
          metadata?: Json | null
          started_at?: string | null
          status: string
          type: Database["pipeline"]["Enums"]["job_type"]
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          listings_found?: number | null
          listings_new?: number | null
          listings_updated?: number | null
          marketplace?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string
          type?: Database["pipeline"]["Enums"]["job_type"]
        }
        Relationships: []
      }
      listing_analysis: {
        Row: {
          analysis_metadata: Json | null
          analysis_version: string | null
          analyzed_at: string | null
          condition: string | null
          estimated_minifig_count: boolean | null
          estimated_piece_count: boolean | null
          id: string
          listing_id: string
          minifig_count: number | null
          piece_count: number | null
          price_per_piece: number | null
        }
        Insert: {
          analysis_metadata?: Json | null
          analysis_version?: string | null
          analyzed_at?: string | null
          condition?: string | null
          estimated_minifig_count?: boolean | null
          estimated_piece_count?: boolean | null
          id?: string
          listing_id: string
          minifig_count?: number | null
          piece_count?: number | null
          price_per_piece?: number | null
        }
        Update: {
          analysis_metadata?: Json | null
          analysis_version?: string | null
          analyzed_at?: string | null
          condition?: string | null
          estimated_minifig_count?: boolean | null
          estimated_piece_count?: boolean | null
          id?: string
          listing_id?: string
          minifig_count?: number | null
          piece_count?: number | null
          price_per_piece?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_analysis_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          additional_images: string[] | null
          buying_options: string[] | null
          category_path: string | null
          condition_description: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          enriched_at: string | null
          enriched_raw_listing_id: string | null
          estimated_availabilities: Json | null
          external_id: string
          first_seen_at: string | null
          id: string
          image_urls: string[] | null
          item_location: Json | null
          last_seen_at: string | null
          location: string | null
          marketplace: string
          price: number | null
          raw_listing_id: string
          seller_name: string | null
          seller_rating: number | null
          status: string | null
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          additional_images?: string[] | null
          buying_options?: string[] | null
          category_path?: string | null
          condition_description?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          enriched_at?: string | null
          enriched_raw_listing_id?: string | null
          estimated_availabilities?: Json | null
          external_id: string
          first_seen_at?: string | null
          id?: string
          image_urls?: string[] | null
          item_location?: Json | null
          last_seen_at?: string | null
          location?: string | null
          marketplace: string
          price?: number | null
          raw_listing_id: string
          seller_name?: string | null
          seller_rating?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          additional_images?: string[] | null
          buying_options?: string[] | null
          category_path?: string | null
          condition_description?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          enriched_at?: string | null
          enriched_raw_listing_id?: string | null
          estimated_availabilities?: Json | null
          external_id?: string
          first_seen_at?: string | null
          id?: string
          image_urls?: string[] | null
          item_location?: Json | null
          last_seen_at?: string | null
          location?: string | null
          marketplace?: string
          price?: number | null
          raw_listing_id?: string
          seller_name?: string | null
          seller_rating?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_enriched_raw_listing_id_fkey"
            columns: ["enriched_raw_listing_id"]
            isOneToOne: false
            referencedRelation: "raw_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_raw_listing_id_fkey"
            columns: ["raw_listing_id"]
            isOneToOne: false
            referencedRelation: "raw_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_listings: {
        Row: {
          api_response: Json
          created_at: string | null
          id: string
          marketplace: string
        }
        Insert: {
          api_response: Json
          created_at?: string | null
          id?: string
          marketplace: string
        }
        Update: {
          api_response?: Json
          created_at?: string | null
          id?: string
          marketplace?: string
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
      job_type: "ebay_refresh_listings" | "ebay_enrich_listings"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ebay_marketplace_account_deletion_notifications: {
        Row: {
          created_at: string
          eias_token: string | null
          event_date: string | null
          notification_id: string
          publish_attempt_count: number | null
          publish_date: string | null
          raw_payload: Json
          signature: string | null
          topic: string | null
          user_id: string | null
          username: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string
          eias_token?: string | null
          event_date?: string | null
          notification_id: string
          publish_attempt_count?: number | null
          publish_date?: string | null
          raw_payload: Json
          signature?: string | null
          topic?: string | null
          user_id?: string | null
          username?: string | null
          verified?: boolean
        }
        Update: {
          created_at?: string
          eias_token?: string | null
          event_date?: string | null
          notification_id?: string
          publish_attempt_count?: number | null
          publish_date?: string | null
          raw_payload?: Json
          signature?: string | null
          topic?: string | null
          user_id?: string | null
          username?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      search_results: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string
          notified_at: string | null
          search_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id: string
          notified_at?: string | null
          search_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string
          notified_at?: string | null
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          alert_frequency: string | null
          created_at: string | null
          email_alerts_enabled: boolean | null
          id: string
          max_price_per_piece: number
          name: string
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          alert_frequency?: string | null
          created_at?: string | null
          email_alerts_enabled?: boolean | null
          id?: string
          max_price_per_piece: number
          name: string
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          alert_frequency?: string | null
          created_at?: string | null
          email_alerts_enabled?: boolean | null
          id?: string
          max_price_per_piece?: number
          name?: string
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "searches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

