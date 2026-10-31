export type SchemeCategory = string;
export type ApplicationStatus = 'not_started' | 'preparing' | 'applied' | 'follow_up' | 'completed';

export interface SchemeSource { label: string; url: string }
export interface Scheme {
  id: string;
  name: string;
  category: SchemeCategory;
  summary: string;
  benefit: string;
  eligibility: string;
  documents: string[];
  document_note: string;
  deadline: string;
  official_url: string;
  apply_url: string;
  sources: SchemeSource[];
  verified_at: string;
  eligibility_rule: string;
  saved: boolean;
  application_status: ApplicationStatus | null;
  updated_at: string | null;
}

export interface FarmerSchemeContext {
  location_name: string;
  village_town: string;
  farm_district: string;
  farm_state: string;
  land_area_acres: number;
  crops: string[];
}

export interface FarmerSchemesResponse { items: Scheme[]; farmer_context: FarmerSchemeContext | null }
