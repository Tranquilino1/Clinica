/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  orderBy,
  limit,
  OperationType,
  handleFirestoreError,
  FirebaseUser
} from './firebase';
import { 
  UserRole, 
  UserProfile, 
  Patient, 
  Consultation, 
  Hospitalization, 
  InventoryItem, 
  EvolutionLog, 
  SupplyUsage 
} from './types';
import { 
  Users, 
  Search, 
  Plus, 
  History, 
  Stethoscope, 
  Bed, 
  Package, 
  LogOut, 
  FileText, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  ChevronRight, 
  Save, 
  X, 
  Download,
  Activity,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { cn } from './lib/utils';

// --- Constants & Themes ---
const COLORS = {
  gold: '#D4AF37',
  black: '#000000',
  white: '#FFFFFF',
  green: '#22C55E',
  red: '#EF4444',
  gray: '#F3F4F6',
};

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' }) => {
  const variants = {
    primary: 'bg-black text-white hover:bg-gray-800',
    secondary: `bg-[#D4AF37] text-black hover:bg-[#B8962E]`,
    danger: 'bg-red-500 text-white hover:bg-red-600',
    success: 'bg-green-500 text-white hover:bg-green-600',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
  };

  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, title, ...props }: { children: React.ReactNode; className?: string; title?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden', className)} {...props}>
    {title && (
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input 
      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all"
      {...props}
    />
  </div>
);

const Select = ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { label: string; value: string }[] }) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <select 
      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all bg-white"
      {...props}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const TextArea = ({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <textarea 
      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none transition-all min-h-[100px]"
      {...props}
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'patients' | 'consultations' | 'hospitalizations' | 'inventory' | 'reports' | 'users'>('dashboard');
  
  // Data States
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [hospitalizations, setHospitalizations] = useState<Hospitalization[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [showHospitalizationModal, setShowHospitalizationModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedHospitalization, setSelectedHospitalization] = useState<Hospitalization | null>(null);

  // --- Auth & Profile ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profileDoc = await getDoc(doc(db, 'users', u.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          // Default to Receptionist for new users (or handle admin setup)
          const newProfile: UserProfile = {
            email: u.email || '',
            name: u.displayName || 'Personal',
            role: u.email === 'thetrapkinzofafrica@gmail.com' ? 'Admin' : 'Recepcionista'
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- Real-time Listeners ---

  useEffect(() => {
    if (!user) return;

    const unsubPatients = onSnapshot(collection(db, 'patients'), (snap) => {
      setPatients(snap.docs.map(d => ({ ...d.data(), docId: d.id } as Patient)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'patients'));

    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory'));

    const unsubHospitalizations = onSnapshot(collection(db, 'hospitalizations'), (snap) => {
      setHospitalizations(snap.docs.map(d => ({ ...d.data(), id: d.id } as Hospitalization)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'hospitalizations'));

    const unsubConsultations = onSnapshot(collection(db, 'consultations'), (snap) => {
      setConsultations(snap.docs.map(d => ({ ...d.data(), id: d.id } as Consultation)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'consultations'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ ...d.data(), id: d.id } as any)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => {
      unsubPatients();
      unsubInventory();
      unsubHospitalizations();
      unsubConsultations();
      unsubUsers();
    };
  }, [user]);

  // --- Handlers ---

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login Error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const generatePrescriptionPDF = (consultation: Consultation, patient: Patient) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(212, 175, 55); // Gold
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('CLÍNICA AAUCA', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Nota de Consulta Médica y Receta', 105, 30, { align: 'center' });

    // Patient Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('Información del Paciente', 20, 50);
    doc.setFontSize(10);
    doc.text(`Nombre: ${patient.name}`, 20, 60);
    doc.text(`ID: ${patient.id}`, 20, 65);
    doc.text(`Fecha Nac: ${patient.dob}`, 20, 70);
    doc.text(`Género: ${patient.gender}`, 20, 75);
    doc.text(`Fecha: ${format(new Date(consultation.createdAt), 'PPP')}`, 140, 60);

    // Consultation Details
    doc.setFontSize(14);
    doc.text('Detalles de la Consulta', 20, 90);
    doc.setFontSize(10);
    doc.text('Motivo de la Visita:', 20, 100);
    doc.text(consultation.reason, 20, 105, { maxWidth: 170 });
    
    doc.text('Diagnóstico:', 20, 120);
    doc.text(consultation.diagnosis, 20, 125, { maxWidth: 170 });

    doc.text('Tratamiento / Receta:', 20, 140);
    doc.text(consultation.treatment, 20, 145, { maxWidth: 170 });

    doc.text('Recomendaciones:', 20, 165);
    doc.text(consultation.recommendations, 20, 170, { maxWidth: 170 });

    // Footer
    doc.text('__________________________', 140, 250);
    doc.text(`Dr. ${consultation.doctorName}`, 140, 260);
    doc.text('Firma Autorizada', 140, 265);

    doc.save(`Receta_${patient.name}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  // --- Filtered Data ---

  const filteredPatients = useMemo(() => {
    return patients.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [patients, searchQuery]);

  const lowStockItems = useMemo(() => {
    return inventory.filter(item => item.stock <= item.threshold);
  }, [inventory]);

  // --- Render Helpers ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-[#D4AF37] rounded-full flex items-center justify-center mx-auto shadow-lg">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-black">Clínica AAUCA</h1>
            <p className="text-gray-500">Sistema de Gestión</p>
          </div>
          <Button onClick={handleLogin} className="w-full py-4 text-lg">
            Iniciar sesión con Google
          </Button>
          <p className="text-xs text-gray-400">Solo personal autorizado</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-black text-white flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-gray-800">
          <div className="w-10 h-10 bg-[#D4AF37] rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-black" />
          </div>
          <span className="font-bold text-xl tracking-tight">AAUCA</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<BarChart3 className="w-5 h-5" />} 
            label="Panel de Control" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={<Users className="w-5 h-5" />} 
            label="Pacientes" 
            active={activeTab === 'patients'} 
            onClick={() => setActiveTab('patients')} 
          />
          {(profile?.role === 'Médico' || profile?.role === 'Admin') && (
            <SidebarItem 
              icon={<History className="w-5 h-5" />} 
              label="Consultas" 
              active={activeTab === 'consultations'} 
              onClick={() => setActiveTab('consultations')} 
            />
          )}
          {(profile?.role === 'Médico' || profile?.role === 'Enfermero' || profile?.role === 'Admin') && (
            <SidebarItem 
              icon={<Bed className="w-5 h-5" />} 
              label="Hospitalización" 
              active={activeTab === 'hospitalizations'} 
              onClick={() => setActiveTab('hospitalizations')} 
            />
          )}
          {(profile?.role === 'Enfermero' || profile?.role === 'Admin') && (
            <SidebarItem 
              icon={<Package className="w-5 h-5" />} 
              label="Inventario" 
              active={activeTab === 'inventory'} 
              onClick={() => setActiveTab('inventory')} 
            />
          )}
          {profile?.role === 'Admin' && (
            <SidebarItem 
              icon={<FileText className="w-5 h-5" />} 
              label="Informes" 
              active={activeTab === 'reports'} 
              onClick={() => setActiveTab('reports')} 
            />
          )}
          {profile?.role === 'Admin' && (
            <SidebarItem 
              icon={<Users className="w-5 h-5" />} 
              label="Gestión de Personal" 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')} 
            />
          )}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 p-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
              {profile?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.name}</p>
              <p className="text-xs text-gray-500 truncate">{profile?.role}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full text-gray-400 hover:text-white hover:bg-gray-800">
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 capitalize">{activeTab === 'dashboard' ? 'Panel de Control' : activeTab === 'patients' ? 'Pacientes' : activeTab === 'consultations' ? 'Consultas' : activeTab === 'hospitalizations' ? 'Hospitalización' : activeTab === 'inventory' ? 'Inventario' : activeTab === 'reports' ? 'Informes' : 'Personal'}</h2>
            <p className="text-gray-500">Bienvenido de nuevo, {profile?.name}</p>
          </div>
          
          {activeTab === 'patients' && (profile?.role === 'Recepcionista' || profile?.role === 'Admin') && (
            <Button onClick={() => setShowPatientModal(true)} variant="secondary">
              <Plus className="w-4 h-4" /> Registrar Paciente
            </Button>
          )}

          {activeTab === 'inventory' && (profile?.role === 'Enfermero' || profile?.role === 'Admin') && (
            <Button onClick={() => setShowInventoryModal(true)} variant="secondary">
              <Plus className="w-4 h-4" /> Añadir Artículo
            </Button>
          )}
        </header>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Pacientes" value={patients.length} icon={<Users className="text-blue-500" />} />
              <StatCard title="Hospitalizaciones Activas" value={hospitalizations.filter(h => h.status === 'Activo').length} icon={<Bed className="text-orange-500" />} />
              <StatCard title="Stock Bajo" value={lowStockItems.length} icon={<AlertTriangle className="text-red-500" />} />
              <StatCard title="Consultas (Total)" value={consultations.length} icon={<History className="text-green-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Consultas Recientes">
                <div className="space-y-4">
                  {consultations.slice(0, 5).map(c => {
                    const patient = patients.find(p => p.id === c.patientId);
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div>
                          <p className="font-medium text-gray-900">{patient?.name || 'Desconocido'}</p>
                          <p className="text-xs text-gray-500">{format(new Date(c.createdAt), 'PPp')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700">{c.diagnosis}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="Alertas de Inventario">
                <div className="space-y-4">
                  {lowStockItems.length > 0 ? lowStockItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="font-medium text-red-900">{item.name}</p>
                          <p className="text-xs text-red-700">Solo quedan {item.stock} {item.unit}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-100">Reponer</Button>
                    </div>
                  )) : (
                    <p className="text-center text-gray-500 py-8">Todos los artículos están en stock.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input 
                placeholder="Buscar por nombre o ID..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Card className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">ID</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Nombre</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Género</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Fecha Nac</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPatients.map(p => (
                      <tr key={p.docId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{p.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{p.gender}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{p.dob}</td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          {profile?.role === 'Médico' && (
                            <Button size="sm" variant="secondary" onClick={() => { setSelectedPatient(p); setShowConsultationModal(true); }}>
                              <Stethoscope className="w-4 h-4" /> Consultar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedPatient(p); setShowPatientModal(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'consultations' && (
          <div className="grid grid-cols-1 gap-6">
            {consultations.map(c => {
              const patient = patients.find(p => p.id === c.patientId);
              return (
                <Card key={c.id} className="hover:border-[#D4AF37] transition-all">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-gray-900">{patient?.name || 'Paciente Desconocido'}</h4>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{c.patientId}</span>
                      </div>
                      <p className="text-sm text-gray-500">Consultado por Dr. {c.doctorName} el {format(new Date(c.createdAt), 'PPP p')}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Motivo</p>
                          <p className="text-sm text-gray-700">{c.reason}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Diagnóstico</p>
                          <p className="text-sm text-gray-700">{c.diagnosis}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Button variant="ghost" onClick={() => patient && generatePrescriptionPDF(c, patient)}>
                        <Download className="w-4 h-4" /> PDF
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'hospitalizations' && (
          <div className="space-y-6">
             <div className="flex justify-end">
                {(profile?.role === 'Médico' || profile?.role === 'Admin') && (
                  <Button onClick={() => setShowHospitalizationModal(true)} variant="secondary">
                    <Plus className="w-4 h-4" /> Nueva Admisión
                  </Button>
                )}
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hospitalizations.map(h => (
                  <Card key={h.id} className={cn("border-l-4", h.status === 'Activo' ? "border-l-green-500" : "border-l-gray-300")}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-lg">{h.patientName}</h4>
                        <p className="text-sm text-gray-500">Cama: {h.bed}</p>
                      </div>
                      <span className={cn("px-2 py-1 rounded-full text-xs font-bold", h.status === 'Activo' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700")}>
                        {h.status}
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Admitido:</span>
                        <span className="font-medium">{format(new Date(h.createdAt), 'PP')}</span>
                      </div>
                      
                      <div className="pt-4 border-t border-gray-100 flex gap-2">
                        <Button variant="ghost" className="flex-1" onClick={() => { setSelectedHospitalization(h); setShowHospitalizationModal(true); }}>
                          <Activity className="w-4 h-4" /> Evolución
                        </Button>
                        {h.status === 'Activo' && (profile?.role === 'Médico' || profile?.role === 'Admin') && (
                          <Button variant="danger" className="flex-1" onClick={async () => {
                            if (confirm('¿Dar de alta a este paciente?')) {
                              await updateDoc(doc(db, 'hospitalizations', h.id!), { status: 'Alta' });
                            }
                          }}>
                            Dar de Alta
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Nombre del Artículo</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Stock</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Unidad</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Estado</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventory.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.stock}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.unit}</td>
                      <td className="px-6 py-4 text-sm">
                        {item.stock <= item.threshold ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Stock Bajo</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">En Stock</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={async () => {
                            const newStock = prompt('Ingrese la nueva cantidad de stock:', item.stock.toString());
                            if (newStock !== null) {
                              await updateDoc(doc(db, 'inventory', item.id!), { stock: parseInt(newStock) });
                            }
                          }}>
                            <Plus className="w-4 h-4" /> Reponer
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { /* Edit logic */ }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Consultas por Mes">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getMonthlyStats(consultations)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Demografía de Pacientes (Género)">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getGenderStats(patients)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {getGenderStats(patients).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#D4AF37' : index === 1 ? '#000000' : '#888888'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Nombre</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Email</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Rol</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{u.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <select 
                          value={u.role} 
                          onChange={async (e) => {
                            await updateDoc(doc(db, 'users', u.id), { role: e.target.value });
                          }}
                          className="bg-transparent border-none focus:ring-0 text-sm font-medium"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Médico">Médico</option>
                          <option value="Enfermero">Enfermero</option>
                          <option value="Recepcionista">Recepcionista</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={async () => {
                          if (confirm('¿Eliminar este usuario?')) {
                            await deleteDoc(doc(db, 'users', u.id));
                          }
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* Modals */}
      {showPatientModal && (
        <PatientModal 
          patient={selectedPatient} 
          onClose={() => { setShowPatientModal(false); setSelectedPatient(null); }} 
        />
      )}

      {showConsultationModal && selectedPatient && (
        <ConsultationModal 
          patient={selectedPatient} 
          doctor={profile!} 
          onClose={() => { setShowConsultationModal(false); setSelectedPatient(null); }} 
        />
      )}

      {showHospitalizationModal && (
        <HospitalizationModal 
          hospitalization={selectedHospitalization}
          patients={patients}
          onClose={() => { setShowHospitalizationModal(false); setSelectedHospitalization(null); }}
        />
      )}

      {showInventoryModal && (
        <InventoryModal 
          onClose={() => setShowInventoryModal(false)}
        />
      )}
    </div>
  );
}

// --- Sub-components & Helpers ---

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium',
        active ? 'bg-[#D4AF37] text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-6">
      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </Card>
  );
}

// --- Modals ---

function PatientModal({ patient, onClose }: { patient: Patient | null; onClose: () => void }) {
  const [formData, setFormData] = useState<Partial<Patient>>(patient || {
    id: '',
    name: '',
    dob: '',
    gender: 'Masculino',
    history: '',
    familyHistory: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (patient?.docId) {
        await updateDoc(doc(db, 'patients', patient.docId), { ...formData });
      } else {
        await addDoc(collection(db, 'patients'), { 
          ...formData, 
          createdAt: new Date().toISOString() 
        });
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, patient ? OperationType.UPDATE : OperationType.CREATE, 'patients');
    }
  };

  return (
    <Modal title={patient ? 'Editar Paciente' : 'Registrar Paciente'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Número de Historia (ID)" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} required disabled={!!patient} />
          <Input label="Nombre Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <Input label="Fecha de Nacimiento" type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} required />
          <Select 
            label="Género" 
            value={formData.gender} 
            onChange={e => setFormData({...formData, gender: e.target.value as any})}
            options={[{label: 'Masculino', value: 'Masculino'}, {label: 'Femenino', value: 'Femenino'}, {label: 'Otro', value: 'Otro'}]}
          />
        </div>
        <TextArea label="Historial Médico" value={formData.history} onChange={e => setFormData({...formData, history: e.target.value})} />
        <TextArea label="Antecedentes Familiares" value={formData.familyHistory} onChange={e => setFormData({...formData, familyHistory: e.target.value})} />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="secondary">Guardar Paciente</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConsultationModal({ patient, doctor, onClose }: { patient: Patient; doctor: UserProfile; onClose: () => void }) {
  const [formData, setFormData] = useState({
    reason: '',
    diagnosis: '',
    treatment: '',
    recommendations: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'consultations'), {
        ...formData,
        patientId: patient.id,
        doctorId: auth.currentUser?.uid,
        doctorName: doctor.name,
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'consultations');
    }
  };

  return (
    <Modal title={`Consulta: ${patient.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextArea label="Motivo de la Visita" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} required />
        <TextArea label="Diagnóstico" value={formData.diagnosis} onChange={e => setFormData({...formData, diagnosis: e.target.value})} required />
        <TextArea label="Tratamiento / Receta" value={formData.treatment} onChange={e => setFormData({...formData, treatment: e.target.value})} required />
        <TextArea label="Recomendaciones" value={formData.recommendations} onChange={e => setFormData({...formData, recommendations: e.target.value})} />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="secondary">Completar Consulta</Button>
        </div>
      </form>
    </Modal>
  );
}

function HospitalizationModal({ hospitalization, patients, onClose }: { hospitalization: Hospitalization | null; patients: Patient[]; onClose: () => void }) {
  const [formData, setFormData] = useState<Partial<Hospitalization>>(hospitalization || {
    patientId: '',
    patientName: '',
    bed: '',
    status: 'Activo',
    evolutionLogs: [],
    supplies: []
  });

  const [newLog, setNewLog] = useState<EvolutionLog>({
    timestamp: new Date().toISOString(),
    temp: 37,
    bp: '120/80',
    pulse: 75,
    notes: ''
  });

  const [newSupply, setNewSupply] = useState<SupplyUsage>({ name: '', qty: 1 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (hospitalization?.id) {
        await updateDoc(doc(db, 'hospitalizations', hospitalization.id), { ...formData });
      } else {
        const patient = patients.find(p => p.id === formData.patientId);
        await addDoc(collection(db, 'hospitalizations'), {
          ...formData,
          patientName: patient?.name || 'Desconocido',
          createdAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, hospitalization ? OperationType.UPDATE : OperationType.CREATE, 'hospitalizations');
    }
  };

  const addEvolution = () => {
    setFormData({
      ...formData,
      evolutionLogs: [newLog, ...(formData.evolutionLogs || [])]
    });
    setNewLog({
      timestamp: new Date().toISOString(),
      temp: 37,
      bp: '120/80',
      pulse: 75,
      notes: ''
    });
  };

  const addSupply = () => {
    if (!newSupply.name) return;
    setFormData({
      ...formData,
      supplies: [...(formData.supplies || []), newSupply]
    });
    setNewSupply({ name: '', qty: 1 });
  };

  return (
    <Modal title={hospitalization ? 'Evolución del Paciente' : 'Nueva Admisión'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {!hospitalization && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Seleccionar Paciente" 
              value={formData.patientId} 
              onChange={e => setFormData({...formData, patientId: e.target.value})}
              options={[{label: 'Seleccionar...', value: ''}, ...patients.map(p => ({label: p.name, value: p.id}))]}
              required
            />
            <Input label="Número de Cama" value={formData.bed} onChange={e => setFormData({...formData, bed: e.target.value})} required />
          </div>
        )}

        {hospitalization && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-bold text-gray-700 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Añadir Registro de Evolución
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <Input label="Temp (°C)" type="number" step="0.1" value={newLog.temp} onChange={e => setNewLog({...newLog, temp: parseFloat(e.target.value)})} />
              <Input label="Presión Art." placeholder="120/80" value={newLog.bp} onChange={e => setNewLog({...newLog, bp: e.target.value})} />
              <Input label="Pulso" type="number" value={newLog.pulse} onChange={e => setNewLog({...newLog, pulse: parseInt(e.target.value)})} />
            </div>
            <TextArea label="Notas" value={newLog.notes} onChange={e => setNewLog({...newLog, notes: e.target.value})} />
            <Button type="button" onClick={addEvolution} variant="primary" className="w-full">Añadir Registro</Button>

            <div className="space-y-3 mt-6">
              <h4 className="font-bold text-gray-700">Historial de Evolución</h4>
              {formData.evolutionLogs?.map((log, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-gray-500">{format(new Date(log.timestamp), 'PPp')}</span>
                    <span className="text-gray-700">T: {log.temp}°C | PA: {log.bp} | P: {log.pulse}</span>
                  </div>
                  <p className="text-gray-600 italic">{log.notes}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4 border-t pt-4">
              <h4 className="font-bold text-gray-700 flex items-center gap-2">
                <Package className="w-4 h-4" /> Administrar Insumos
              </h4>
              <div className="flex gap-2">
                <Input placeholder="Nombre del Insumo" value={newSupply.name} onChange={e => setNewSupply({...newSupply, name: e.target.value})} />
                <Input type="number" className="w-24" value={newSupply.qty} onChange={e => setNewSupply({...newSupply, qty: parseInt(e.target.value)})} />
                <Button type="button" onClick={addSupply} variant="primary">Añadir</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.supplies?.map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium flex items-center gap-2">
                    {s.name} x{s.qty}
                    <button type="button" onClick={() => setFormData({...formData, supplies: formData.supplies?.filter((_, idx) => idx !== i)})} className="hover:text-blue-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="secondary">Guardar Admisión</Button>
        </div>
      </form>
    </Modal>
  );
}

function InventoryModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    stock: 0,
    unit: 'Tabletas',
    threshold: 10
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'inventory'), {
        ...formData,
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'inventory');
    }
  };

  return (
    <Modal title="Añadir Artículo al Inventario" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre del Artículo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Stock Inicial" type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})} required />
          <Input label="Unidad" placeholder="ej. Tabletas, Viales" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} required />
        </div>
        <Input label="Umbral de Stock Bajo" type="number" value={formData.threshold} onChange={e => setFormData({...formData, threshold: parseInt(e.target.value)})} required />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="secondary">Añadir Artículo</Button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Stats Helpers ---

function getMonthlyStats(consultations: Consultation[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const stats = months.map(m => ({ name: m, count: 0 }));
  
  consultations.forEach(c => {
    const monthIndex = new Date(c.createdAt).getMonth();
    stats[monthIndex].count++;
  });
  
  return stats;
}

function getGenderStats(patients: Patient[]) {
  const stats = [
    { name: 'Masculino', value: 0 },
    { name: 'Femenino', value: 0 },
    { name: 'Otro', value: 0 }
  ];
  
  patients.forEach(p => {
    const stat = stats.find(s => s.name === p.gender);
    if (stat) stat.value++;
  });
  
  return stats;
}
