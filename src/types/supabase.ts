export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type OrganizationRole = 'owner' | 'project_manager' | 'employee'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectVisibility = 'organization' | 'restricted'

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
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
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
            foreignKeyName: 'organization_members_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'organization_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
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
            foreignKeyName: 'organization_invitations_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      clients: {
        Row: {
          id: string
          organization_id: string
          name: string
          contact_name: string | null
          email: string | null
          phone: string | null
          address: string | null
          website: string | null
          business_category: string | null
          archived_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          website?: string | null
          business_category?: string | null
          archived_at?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          website?: string | null
          business_category?: string | null
          archived_at?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clients_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      client_private_details: {
        Row: {
          organization_id: string
          client_id: string
          tax_id: string | null
          internal_notes: string | null
          updated_at: string
        }
        Insert: {
          organization_id: string
          client_id: string
          tax_id?: string | null
          internal_notes?: string | null
          updated_at?: string
        }
        Update: {
          organization_id?: string
          client_id?: string
          tax_id?: string | null
          internal_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_private_details_client_fkey'
            columns: ['organization_id', 'client_id']
            isOneToOne: true
            referencedRelation: 'clients'
            referencedColumns: ['organization_id', 'id']
          },
        ]
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          client_id: string | null
          name: string
          description: string | null
          project_type: string | null
          status: ProjectStatus
          priority: ProjectPriority
          start_date: string | null
          deadline: string | null
          completed_at: string | null
          visibility: ProjectVisibility
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          client_id?: string | null
          name: string
          description?: string | null
          project_type?: string | null
          status?: ProjectStatus
          priority?: ProjectPriority
          start_date?: string | null
          deadline?: string | null
          completed_at?: string | null
          visibility?: ProjectVisibility
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string | null
          name?: string
          description?: string | null
          project_type?: string | null
          status?: ProjectStatus
          priority?: ProjectPriority
          start_date?: string | null
          deadline?: string | null
          completed_at?: string | null
          visibility?: ProjectVisibility
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_organization_client_fkey'
            columns: ['organization_id', 'client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['organization_id', 'id']
          },
        ]
      }
      project_members: {
        Row: {
          organization_id: string
          project_id: string
          user_id: string
          is_project_manager: boolean
          can_view: boolean
          can_edit: boolean
          can_manage_members: boolean
          can_manage_tasks: boolean
          can_manage_milestones: boolean
          can_edit_info: boolean
          can_access_sensitive: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          project_id: string
          user_id: string
          is_project_manager?: boolean
          can_view?: boolean
          can_edit?: boolean
          can_manage_members?: boolean
          can_manage_tasks?: boolean
          can_manage_milestones?: boolean
          can_edit_info?: boolean
          can_access_sensitive?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          organization_id?: string
          project_id?: string
          user_id?: string
          is_project_manager?: boolean
          can_view?: boolean
          can_edit?: boolean
          can_manage_members?: boolean
          can_manage_tasks?: boolean
          can_manage_milestones?: boolean
          can_edit_info?: boolean
          can_access_sensitive?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_members_project_fkey'
            columns: ['organization_id', 'project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['organization_id', 'id']
          },
          {
            foreignKeyName: 'project_members_organization_member_fkey'
            columns: ['organization_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'organization_members'
            referencedColumns: ['organization_id', 'user_id']
          },
        ]
      }
      project_private_details: {
        Row: {
          organization_id: string
          project_id: string
          project_value: number | null
          technology_stack: string | null
          repository_url: string | null
          live_url: string | null
          hosting_provider: string | null
          deployment_information: string | null
          technical_notes: string | null
          internal_notes: string | null
          updated_at: string
        }
        Insert: {
          organization_id: string
          project_id: string
          project_value?: number | null
          technology_stack?: string | null
          repository_url?: string | null
          live_url?: string | null
          hosting_provider?: string | null
          deployment_information?: string | null
          technical_notes?: string | null
          internal_notes?: string | null
          updated_at?: string
        }
        Update: {
          organization_id?: string
          project_id?: string
          project_value?: number | null
          technology_stack?: string | null
          repository_url?: string | null
          live_url?: string | null
          hosting_provider?: string | null
          deployment_information?: string | null
          technical_notes?: string | null
          internal_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_private_details_project_fkey'
            columns: ['organization_id', 'project_id']
            isOneToOne: true
            referencedRelation: 'projects'
            referencedColumns: ['organization_id', 'id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
