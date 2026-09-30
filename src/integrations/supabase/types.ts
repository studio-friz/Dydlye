export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          is_host: boolean;
          host_active_until: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          is_host?: boolean;
          host_active_until?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          is_host?: boolean;
          host_active_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          owner_id: string | null;
          title: string;
          description: string | null;
          price: number;
          type: "فيلا" | "شقة" | "رياض" | "استوديو" | null;
          city: string;
          location: string;
          bedrooms: number | null;
          bathrooms: number | null;
          area: number | null;
          images: string[] | null;
          features: string[] | null;
          rating: number | null;
          reviews: number | null;
          lat: number | null;
          lng: number | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          title: string;
          description?: string | null;
          price: number;
          type?: "فيلا" | "شقة" | "رياض" | "استوديو" | null;
          city: string;
          location: string;
          bedrooms?: number | null;
          bathrooms?: number | null;
          area?: number | null;
          images?: string[] | null;
          features?: string[] | null;
          rating?: number | null;
          reviews?: number | null;
          lat?: number | null;
          lng?: number | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          title?: string;
          description?: string | null;
          price?: number;
          type?: "فيلا" | "شقة" | "رياض" | "استوديو" | null;
          city?: string;
          location?: string;
          bedrooms?: number | null;
          bathrooms?: number | null;
          area?: number | null;
          images?: string[] | null;
          features?: string[] | null;
          rating?: number | null;
          reviews?: number | null;
          lat?: number | null;
          lng?: number | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          property_id: string;
          user_id: string;
          user_name: string;
          text: string;
          rating: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          user_id: string;
          // Set by the comments_set_author trigger, not by the client (M-03).
          user_name?: string;
          text: string;
          rating?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          user_id?: string;
          user_name?: string;
          text?: string;
          rating?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_reports: {
        Row: {
          id: string;
          property_id: string;
          reporter_id: string | null;
          reason: string;
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          reporter_id?: string | null;
          reason: string;
          details?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          reporter_id?: string | null;
          reason?: string;
          details?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_reports_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      destinations: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string;
          city: string;
          location: string | null;
          lat: number;
          lng: number;
          images: string[] | null;
          phone: string | null;
          opening_hours: string | null;
          rating: number | null;
          reviews: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category: string;
          city: string;
          location?: string | null;
          lat: number;
          lng: number;
          images?: string[] | null;
          phone?: string | null;
          opening_hours?: string | null;
          rating?: number | null;
          reviews?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string;
          city?: string;
          location?: string | null;
          lat?: number;
          lng?: number;
          images?: string[] | null;
          phone?: string | null;
          opening_hours?: string | null;
          rating?: number | null;
          reviews?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          property_id: string;
          start_date: string;
          end_date: string;
          status: string;
          amount: number;
          payment_method: string | null;
          payment_ref: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          property_id: string;
          start_date: string;
          end_date: string;
          status?: string;
          amount?: number;
          payment_method?: string | null;
          payment_ref?: string | null;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          property_id?: string;
          start_date?: string;
          end_date?: string;
          status?: string;
          amount?: number;
          payment_method?: string | null;
          payment_ref?: string | null;
          paid_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_host_subscription_state: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      /** H-10: server-computed amount, forced status='pending'. */
      create_booking: {
        Args: {
          p_property_id: string;
          p_start_date: string;
          p_end_date: string;
        };
        Returns: string;
      };
      /** The only mutation a client may perform on its own booking. */
      cancel_my_booking: {
        Args: { p_booking_id: string };
        Returns: boolean;
      };
      /** M-05/M-06: records the redemption, price resolved server-side. */
      redeem_promo_code: {
        Args: { p_code: string; p_product_id?: string };
        Returns: Json;
      };
      validate_promo_code: {
        Args: { p_code: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
