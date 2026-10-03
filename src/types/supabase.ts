export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type OrganizationRole = 'owner' | 'project_manager' | 'employee'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          email: string | null
          phone: string | null
          address: string | null
          website: string | null
          business_description: string | null
          tax_id: string | null
          currency: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          website?: string | null
          business_description?: string | null
          tax_id?: string | null
          currency?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          website?: string | null
          business_description?: string | null
          tax_id?: string | null
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: OrganizationRole
          joined_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: OrganizationRole
          joined_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: OrganizationRole
          joined_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          recipient_name: string | null
          role: OrganizationRole
          token_hash: string
          invited_by: string | null
          status: InvitationStatus
          created_at: string
          updated_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          recipient_name?: string | null
          role: OrganizationRole
          token_hash: string
          invited_by?: string | null
          status?: InvitationStatus
          created_at?: string
          updated_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          recipient_name?: string | null
          role?: OrganizationRole
          token_hash?: string
          invited_by?: string | null
          status?: InvitationStatus
          created_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_org_member: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { org_id: string }
        Returns: boolean
      }
      get_invitation_by_token: {
        Args: { p_token_hash: string }
        Returns: Array<{
          organization_name: string
          email: string
          recipient_name: string | null
          role: OrganizationRole
          status: InvitationStatus
          is_valid: boolean
        }>
      }
      accept_invitation: {
        Args: { p_token_hash: string }
        Returns: string
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
