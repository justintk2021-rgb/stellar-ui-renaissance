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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      broker_accounts: {
        Row: {
          acc_num: number
          account_id_external: string
          account_name: string | null
          broker_connection_id: string
          created_at: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          acc_num: number
          account_id_external: string
          account_name?: string | null
          broker_connection_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          acc_num?: number
          account_id_external?: string
          account_name?: string | null
          broker_connection_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_accounts_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_connections: {
        Row: {
          account_balance: number | null
          account_currency: string | null
          account_equity: number | null
          active_acc_num: number | null
          active_account_id: string | null
          auto_sync_enabled: boolean | null
          broker_name: string
          connection_status: string | null
          created_at: string
          environment: string | null
          id: string
          last_connected_at: string | null
          last_error: string | null
          login: string
          metaapi_account_id: string | null
          platform: string
          server: string
          sync_interval_seconds: number | null
          token_expiry: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_balance?: number | null
          account_currency?: string | null
          account_equity?: number | null
          active_acc_num?: number | null
          active_account_id?: string | null
          auto_sync_enabled?: boolean | null
          broker_name: string
          connection_status?: string | null
          created_at?: string
          environment?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          login: string
          metaapi_account_id?: string | null
          platform: string
          server: string
          sync_interval_seconds?: number | null
          token_expiry?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_balance?: number | null
          account_currency?: string | null
          account_equity?: number | null
          active_acc_num?: number | null
          active_account_id?: string | null
          auto_sync_enabled?: boolean | null
          broker_name?: string
          connection_status?: string | null
          created_at?: string
          environment?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          login?: string
          metaapi_account_id?: string | null
          platform?: string
          server?: string
          sync_interval_seconds?: number | null
          token_expiry?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_orders: {
        Row: {
          broker_connection_id: string
          broker_order_id: string
          created_at: string
          created_broker_at: string | null
          entry_price: number | null
          id: string
          last_seen_at: string | null
          order_type: string
          raw_payload: Json | null
          side: string
          size: number
          status: string | null
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
        }
        Insert: {
          broker_connection_id: string
          broker_order_id: string
          created_at?: string
          created_broker_at?: string | null
          entry_price?: number | null
          id?: string
          last_seen_at?: string | null
          order_type: string
          raw_payload?: Json | null
          side: string
          size: number
          status?: string | null
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          updated_at?: string
        }
        Update: {
          broker_connection_id?: string
          broker_order_id?: string
          created_at?: string
          created_broker_at?: string | null
          entry_price?: number | null
          id?: string
          last_seen_at?: string | null
          order_type?: string
          raw_payload?: Json | null
          side?: string
          size?: number
          status?: string | null
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_orders_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_positions: {
        Row: {
          broker_connection_id: string
          closed_at: string | null
          comment: string | null
          commission: number | null
          created_at: string
          current_price: number | null
          floating_pl: number | null
          id: string
          last_seen_at: string | null
          magic_number: number | null
          open_price: number
          open_time: string
          position_id: string
          profit: number | null
          raw_payload: Json | null
          side: string | null
          stop_loss: number | null
          swap: number | null
          symbol: string
          take_profit: number | null
          type: string
          updated_at: string
          volume: number
        }
        Insert: {
          broker_connection_id: string
          closed_at?: string | null
          comment?: string | null
          commission?: number | null
          created_at?: string
          current_price?: number | null
          floating_pl?: number | null
          id?: string
          last_seen_at?: string | null
          magic_number?: number | null
          open_price: number
          open_time: string
          position_id: string
          profit?: number | null
          raw_payload?: Json | null
          side?: string | null
          stop_loss?: number | null
          swap?: number | null
          symbol: string
          take_profit?: number | null
          type: string
          updated_at?: string
          volume: number
        }
        Update: {
          broker_connection_id?: string
          closed_at?: string | null
          comment?: string | null
          commission?: number | null
          created_at?: string
          current_price?: number | null
          floating_pl?: number | null
          id?: string
          last_seen_at?: string | null
          magic_number?: number | null
          open_price?: number
          open_time?: string
          position_id?: string
          profit?: number | null
          raw_payload?: Json | null
          side?: string | null
          stop_loss?: number | null
          swap?: number | null
          symbol?: string
          take_profit?: number | null
          type?: string
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "broker_positions_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_sync_logs: {
        Row: {
          broker_connection_id: string
          created_at: string
          ended_at: string | null
          error_message: string | null
          id: string
          records_processed: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          broker_connection_id: string
          created_at?: string
          ended_at?: string | null
          error_message?: string | null
          id?: string
          records_processed?: number | null
          started_at?: string | null
          status?: string
          sync_type: string
        }
        Update: {
          broker_connection_id?: string
          created_at?: string
          ended_at?: string | null
          error_message?: string | null
          id?: string
          records_processed?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_sync_logs_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_trade_history: {
        Row: {
          broker_connection_id: string
          broker_order_id: string | null
          broker_position_id: string | null
          closed_at: string | null
          created_at: string
          entry_price: number
          exit_price: number | null
          fees: number | null
          id: string
          opened_at: string
          raw_payload: Json | null
          realized_pl: number | null
          side: string
          size: number
          symbol: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          broker_connection_id: string
          broker_order_id?: string | null
          broker_position_id?: string | null
          closed_at?: string | null
          created_at?: string
          entry_price: number
          exit_price?: number | null
          fees?: number | null
          id?: string
          opened_at: string
          raw_payload?: Json | null
          realized_pl?: number | null
          side: string
          size: number
          symbol: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          broker_connection_id?: string
          broker_order_id?: string | null
          broker_position_id?: string | null
          closed_at?: string | null
          created_at?: string
          entry_price?: number
          exit_price?: number | null
          fees?: number | null
          id?: string
          opened_at?: string
          raw_payload?: Json | null
          realized_pl?: number | null
          side?: string
          size?: number
          symbol?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_trade_history_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_trades: {
        Row: {
          broker_connection_id: string
          close_price: number | null
          close_time: string | null
          comment: string | null
          commission: number | null
          created_at: string
          id: string
          journal_trade_id: string | null
          magic_number: number | null
          open_price: number
          open_time: string
          profit: number | null
          stop_loss: number | null
          swap: number | null
          symbol: string
          take_profit: number | null
          trade_id: string
          type: string
          updated_at: string
          volume: number
        }
        Insert: {
          broker_connection_id: string
          close_price?: number | null
          close_time?: string | null
          comment?: string | null
          commission?: number | null
          created_at?: string
          id?: string
          journal_trade_id?: string | null
          magic_number?: number | null
          open_price: number
          open_time: string
          profit?: number | null
          stop_loss?: number | null
          swap?: number | null
          symbol: string
          take_profit?: number | null
          trade_id: string
          type: string
          updated_at?: string
          volume: number
        }
        Update: {
          broker_connection_id?: string
          close_price?: number | null
          close_time?: string | null
          comment?: string | null
          commission?: number | null
          created_at?: string
          id?: string
          journal_trade_id?: string | null
          magic_number?: number | null
          open_price?: number
          open_time?: string
          profit?: number | null
          stop_loss?: number | null
          swap?: number | null
          symbol?: string
          take_profit?: number | null
          trade_id?: string
          type?: string
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "broker_trades_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_trades_journal_trade_id_fkey"
            columns: ["journal_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_channels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: []
      }
      community_messages: {
        Row: {
          channel_id: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "community_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "community_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notebook_entries: {
        Row: {
          category: string
          content: string
          created_at: string
          date: string
          deleted_at: string | null
          folder_color: string | null
          folder_id: string | null
          id: string
          is_deleted: boolean
          title: string
          trade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          date: string
          deleted_at?: string | null
          folder_color?: string | null
          folder_id?: string | null
          id?: string
          is_deleted?: boolean
          title: string
          trade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          folder_color?: string | null
          folder_id?: string | null
          id?: string
          is_deleted?: boolean
          title?: string
          trade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_entries_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_id: string | null
          broker_acc_num: number | null
          broker_account_id: string | null
          broker_environment: string | null
          broker_name: string | null
          broker_order_id: string | null
          broker_position_id: string | null
          chart_image: string | null
          checklist_id: string | null
          checklist_state: Json | null
          close_price: number | null
          commission: number | null
          created_at: string
          date: string
          direction: string
          execution_type: string | null
          id: string
          imported_from_broker: boolean | null
          last_broker_sync_at: string | null
          notebook: string | null
          notes: string | null
          open_price: number | null
          pair: string
          result: number
          session: string | null
          strategy: string | null
          swap: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          broker_acc_num?: number | null
          broker_account_id?: string | null
          broker_environment?: string | null
          broker_name?: string | null
          broker_order_id?: string | null
          broker_position_id?: string | null
          chart_image?: string | null
          checklist_id?: string | null
          checklist_state?: Json | null
          close_price?: number | null
          commission?: number | null
          created_at?: string
          date: string
          direction: string
          execution_type?: string | null
          id?: string
          imported_from_broker?: boolean | null
          last_broker_sync_at?: string | null
          notebook?: string | null
          notes?: string | null
          open_price?: number | null
          pair: string
          result: number
          session?: string | null
          strategy?: string | null
          swap?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          broker_acc_num?: number | null
          broker_account_id?: string | null
          broker_environment?: string | null
          broker_name?: string | null
          broker_order_id?: string | null
          broker_position_id?: string | null
          chart_image?: string | null
          checklist_id?: string | null
          checklist_state?: Json | null
          close_price?: number | null
          commission?: number | null
          created_at?: string
          date?: string
          direction?: string
          execution_type?: string | null
          id?: string
          imported_from_broker?: boolean | null
          last_broker_sync_at?: string | null
          notebook?: string | null
          notes?: string | null
          open_price?: number | null
          pair?: string
          result?: number
          session?: string | null
          strategy?: string | null
          swap?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_accounts: {
        Row: {
          broker: string | null
          created_at: string
          currency: string
          goal_balance: number | null
          id: string
          is_default: boolean
          name: string
          profit_target: number | null
          starting_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          broker?: string | null
          created_at?: string
          currency?: string
          goal_balance?: number | null
          id?: string
          is_default?: boolean
          name: string
          profit_target?: number | null
          starting_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          broker?: string | null
          created_at?: string
          currency?: string
          goal_balance?: number | null
          id?: string
          is_default?: boolean
          name?: string
          profit_target?: number | null
          starting_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          accent_color: string
          created_at: string
          custom_color: string | null
          custom_gradient: Json | null
          id: string
          notebook_font: string | null
          sidebar_collapsed: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          custom_color?: string | null
          custom_gradient?: Json | null
          id?: string
          notebook_font?: string | null
          sidebar_collapsed?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          custom_color?: string | null
          custom_gradient?: Json | null
          id?: string
          notebook_font?: string | null
          sidebar_collapsed?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
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
