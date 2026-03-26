export type UserRole = 'Médico' | 'Enfermero' | 'Recepcionista' | 'Admin';

export interface UserProfile {
  email: string;
  role: UserRole;
  name: string;
}

export interface Patient {
  id: string; // Unique history number
  docId?: string; // Firestore document ID
  name: string;
  dob: string;
  gender: 'Masculino' | 'Femenino' | 'Otro';
  history: string;
  familyHistory: string;
  createdAt: string;
}

export interface Consultation {
  id?: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  reason: string;
  diagnosis: string;
  treatment: string;
  recommendations: string;
  createdAt: string;
}

export interface EvolutionLog {
  timestamp: string;
  temp: number;
  bp: string;
  pulse: number;
  notes: string;
}

export interface SupplyUsage {
  name: string;
  qty: number;
}

export interface Hospitalization {
  id?: string;
  patientId: string;
  patientName: string;
  bed: string;
  status: 'Activo' | 'Alta';
  evolutionLogs: EvolutionLog[];
  supplies: SupplyUsage[];
  createdAt: string;
}

export interface InventoryItem {
  id?: string;
  name: string;
  stock: number;
  unit: string;
  threshold: number;
  createdAt: string;
}
