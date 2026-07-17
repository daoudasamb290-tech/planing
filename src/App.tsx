import React, { useState, useEffect } from 'react';
import {
  auth,
  db,
  OperationType,
  handleFirestoreError
} from './firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  User
} from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import {
  Task,
  Project,
  Reminder,
  TaskStatus,
  ProjectStatus,
  Priority,
  ReminderChannel
} from './types';

// Import sub-components
import DashboardOverview from './components/DashboardOverview';
import TaskPlanner from './components/TaskPlanner';
import ProjectList from './components/ProjectList';
import ReminderManager from './components/ReminderManager';
import Calendar from './components/Calendar';

// Icons
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  CalendarDays,
  BellRing,
  LogOut,
  ShieldCheck,
  Smartphone,
  Menu,
  X,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Nav state
  const [currentView, setCurrentView] = useState<'dashboard' | 'tasks' | 'projects' | 'calendar' | 'reminders'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore collections states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Monitor Auth State Changes
  useEffect(() => {
    // Check if we are in local storage mode
    const storedUserMode = localStorage.getItem('tb_user_mode');
    if (storedUserMode === 'local') {
      setUser({
        uid: 'local-user',
        displayName: 'Utilisateur Local',
        email: 'local@example.com',
        isAnonymous: true,
      } as any);
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (localStorage.getItem('tb_user_mode') !== 'local') {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync tasks from Firestore or LocalStorage in real-time
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    if (user.uid === 'local-user') {
      try {
        const localTasks = localStorage.getItem('tb_tasks');
        setTasks(localTasks ? JSON.parse(localTasks) : []);
      } catch (e) {
        console.error("Failed to parse local tasks:", e);
      }
      return;
    }

    const path = 'tasks';
    const q = query(collection(db, path), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Task[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          userId: d.userId,
          title: d.title,
          description: d.description,
          date: d.date,
          time: d.time,
          priority: d.priority,
          status: d.status,
          projectId: d.projectId,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      });
      setTasks(items);
      setFirestoreError(null);
    }, (error) => {
      console.warn("Firestore tasks listener error, falling back to local cache:", error);
      setFirestoreError("Mode Hors-ligne / Sync locale activée.");
      try {
        const localTasks = localStorage.getItem('tb_tasks');
        if (localTasks) {
          setTasks(JSON.parse(localTasks));
        }
      } catch (e) {}
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Sync projects from Firestore or LocalStorage in real-time
  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }

    if (user.uid === 'local-user') {
      try {
        const localProjects = localStorage.getItem('tb_projects');
        setProjects(localProjects ? JSON.parse(localProjects) : []);
      } catch (e) {
        console.error("Failed to parse local projects:", e);
      }
      return;
    }

    const path = 'projects';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Project[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          userId: d.userId,
          title: d.title,
          description: d.description,
          priority: d.priority,
          status: d.status,
          startDate: d.startDate,
          targetDate: d.targetDate,
          milestones: d.milestones || [],
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      });
      setProjects(items);
      setFirestoreError(null);
    }, (error) => {
      console.warn("Firestore projects listener error:", error);
      setFirestoreError("Mode Hors-ligne / Sync locale activée.");
      try {
        const localProjects = localStorage.getItem('tb_projects');
        if (localProjects) {
          setProjects(JSON.parse(localProjects));
        }
      } catch (e) {}
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Sync reminders from Firestore or LocalStorage in real-time
  useEffect(() => {
    if (!user) {
      setReminders([]);
      return;
    }

    if (user.uid === 'local-user') {
      try {
        const localReminders = localStorage.getItem('tb_reminders');
        setReminders(localReminders ? JSON.parse(localReminders) : []);
      } catch (e) {
        console.error("Failed to parse local reminders:", e);
      }
      return;
    }

    const path = 'reminders';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Reminder[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          userId: d.userId,
          title: d.title,
          datetime: d.datetime,
          type: d.type,
          targetId: d.targetId,
          channel: d.channel,
          sent: d.sent,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      });
      setReminders(items);
      setFirestoreError(null);
    }, (error) => {
      console.warn("Firestore reminders listener error:", error);
      setFirestoreError("Mode Hors-ligne / Sync locale activée.");
      try {
        const localReminders = localStorage.getItem('tb_reminders');
        if (localReminders) {
          setReminders(JSON.parse(localReminders));
        }
      } catch (e) {}
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Google Login popup
  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      localStorage.removeItem('tb_user_mode');
    } catch (err: any) {
      console.error("Google Sign-In failed :", err);
      setAuthError(err?.message || "La connexion Google a échoué.");
    }
  };

  const handleEnableLocalMode = () => {
    setAuthError(null);
    localStorage.setItem('tb_user_mode', 'local');
    setUser({
      uid: 'local-user',
      displayName: 'Utilisateur Local',
      email: 'local@example.com',
      isAnonymous: true,
    } as any);
  };

  // Secure guest (anonymous) sign-in for zero friction
  const handleGuestSignIn = async () => {
    try {
      setAuthError(null);
      await signInAnonymously(auth);
      localStorage.removeItem('tb_user_mode');
    } catch (err: any) {
      console.error("Guest Sign-In failed :", err);
      if (err?.code === 'auth/admin-restricted-operation' || err?.message?.includes('admin-restricted-operation')) {
        // Automatically activate local mode to keep things frictionless and working beautifully!
        handleEnableLocalMode();
      } else {
        setAuthError(err?.message || "La connexion Invité a échoué.");
      }
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('tb_user_mode');
    signOut(auth);
    setUser(null);
    setCurrentView('dashboard');
  };

  // Firestore CRUD Handlers with local-first backup & local mode support
  const handleAddTask = async (taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    
    if (user.uid === 'local-user') {
      const newTask: Task = {
        ...taskData,
        id: `local-task-${Date.now()}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updated = [...tasks, newTask];
      setTasks(updated);
      localStorage.setItem('tb_tasks', JSON.stringify(updated));
      return;
    }

    const path = 'tasks';
    try {
      const tempId = `temp-task-${Date.now()}`;
      const newTask: Task = {
        ...taskData,
        id: tempId,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updated = [...tasks, newTask];
      localStorage.setItem('tb_tasks', JSON.stringify(updated));

      await addDoc(collection(db, path), {
        ...taskData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      setFirestoreError("Erreur d'écriture Cloud. Les modifications sont enregistrées localement.");
    }
  };

  const handleAddBatchTasks = async (batchTasks: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[]) => {
    if (!user) return;

    if (user.uid === 'local-user') {
      const newTasks: Task[] = batchTasks.map((t, idx) => ({
        ...t,
        id: `local-task-${Date.now()}-${idx}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      const updated = [...tasks, ...newTasks];
      setTasks(updated);
      localStorage.setItem('tb_tasks', JSON.stringify(updated));
      return;
    }

    const path = 'tasks';
    try {
      const updated = [
        ...tasks,
        ...batchTasks.map((t, idx) => ({
          ...t,
          id: `temp-task-${Date.now()}-${idx}`,
          userId: user!.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }))
      ];
      localStorage.setItem('tb_tasks', JSON.stringify(updated));

      const batch = writeBatch(db);
      batchTasks.forEach(t => {
        const ref = doc(collection(db, path));
        batch.set(ref, {
          ...t,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      setFirestoreError("Erreur d'écriture Cloud (Batch). Enregistré localement.");
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!user) return;

    if (user.uid === 'local-user' || taskId.startsWith('local-')) {
      const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t);
      setTasks(updated);
      localStorage.setItem('tb_tasks', JSON.stringify(updated));
      return;
    }

    const path = `tasks/${taskId}`;
    try {
      const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t);
      setTasks(updated);
      localStorage.setItem('tb_tasks', JSON.stringify(updated));

      const ref = doc(db, 'tasks', taskId);
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      setFirestoreError("Erreur de mise à jour Cloud. Enregistré localement.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;

    if (user.uid === 'local-user' || taskId.startsWith('local-')) {
      const updated = tasks.filter(t => t.id !== taskId);
      setTasks(updated);
      localStorage.setItem('tb_tasks', JSON.stringify(updated));
      return;
    }

    const path = `tasks/${taskId}`;
    try {
      const updated = tasks.filter(t => t.id !== taskId);
      setTasks(updated);
      localStorage.setItem('tb_tasks', JSON.stringify(updated));

      const ref = doc(db, 'tasks', taskId);
      await deleteDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      setFirestoreError("Erreur de suppression Cloud. Supprimé localement.");
    }
  };

  const handleAddProject = async (projectData: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    if (user.uid === 'local-user') {
      const newProj: Project = {
        ...projectData,
        id: `local-proj-${Date.now()}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updated = [...projects, newProj];
      setProjects(updated);
      localStorage.setItem('tb_projects', JSON.stringify(updated));
      return;
    }

    const path = 'projects';
    try {
      const updated = [
        ...projects,
        {
          ...projectData,
          id: `temp-proj-${Date.now()}`,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('tb_projects', JSON.stringify(updated));

      await addDoc(collection(db, path), {
        ...projectData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      setFirestoreError("Erreur de création de projet Cloud. Enregistré localement.");
    }
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!user) return;

    if (user.uid === 'local-user' || projectId.startsWith('local-')) {
      const updated = projects.map(p => p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p);
      setProjects(updated);
      localStorage.setItem('tb_projects', JSON.stringify(updated));
      return;
    }

    const path = `projects/${projectId}`;
    try {
      const updated = projects.map(p => p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p);
      setProjects(updated);
      localStorage.setItem('tb_projects', JSON.stringify(updated));

      const ref = doc(db, 'projects', projectId);
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      setFirestoreError("Erreur de mise à jour de projet Cloud. Enregistré localement.");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user) return;

    if (user.uid === 'local-user' || projectId.startsWith('local-')) {
      const updated = projects.filter(p => p.id !== projectId);
      setProjects(updated);
      localStorage.setItem('tb_projects', JSON.stringify(updated));
      return;
    }

    const path = `projects/${projectId}`;
    try {
      const updated = projects.filter(p => p.id !== projectId);
      setProjects(updated);
      localStorage.setItem('tb_projects', JSON.stringify(updated));

      const ref = doc(db, 'projects', projectId);
      await deleteDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      setFirestoreError("Erreur de suppression de projet Cloud. Supprimé localement.");
    }
  };

  const handleAddReminder = async (reminderData: Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    if (user.uid === 'local-user') {
      const newReminder: Reminder = {
        ...reminderData,
        id: `local-reminder-${Date.now()}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updated = [...reminders, newReminder];
      setReminders(updated);
      localStorage.setItem('tb_reminders', JSON.stringify(updated));
      return;
    }

    const path = 'reminders';
    try {
      const updated = [
        ...reminders,
        {
          ...reminderData,
          id: `temp-reminder-${Date.now()}`,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('tb_reminders', JSON.stringify(updated));

      await addDoc(collection(db, path), {
        ...reminderData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      setFirestoreError("Erreur de création de rappel Cloud. Enregistré localement.");
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!user) return;

    if (user.uid === 'local-user' || reminderId.startsWith('local-')) {
      const updated = reminders.filter(r => r.id !== reminderId);
      setReminders(updated);
      localStorage.setItem('tb_reminders', JSON.stringify(updated));
      return;
    }

    const path = `reminders/${reminderId}`;
    try {
      const updated = reminders.filter(r => r.id !== reminderId);
      setReminders(updated);
      localStorage.setItem('tb_reminders', JSON.stringify(updated));

      const ref = doc(db, 'reminders', reminderId);
      await deleteDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      setFirestoreError("Erreur de suppression de rappel Cloud. Supprimé localement.");
    }
  };

  const handleUpdateReminder = async (reminderId: string, updates: Partial<Reminder>) => {
    if (!user) return;

    if (user.uid === 'local-user' || reminderId.startsWith('local-')) {
      const updated = reminders.map(r => r.id === reminderId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
      setReminders(updated);
      localStorage.setItem('tb_reminders', JSON.stringify(updated));
      return;
    }

    const path = `reminders/${reminderId}`;
    try {
      const updated = reminders.map(r => r.id === reminderId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
      setReminders(updated);
      localStorage.setItem('tb_reminders', JSON.stringify(updated));

      const ref = doc(db, 'reminders', reminderId);
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      setFirestoreError("Erreur de mise à jour de rappel Cloud. Enregistré localement.");
    }
  };

  // Backend API Calling Helpers for Gemini AI Functions
  const handleBreakdownProjectAI = async (title: string, description: string) => {
    const res = await fetch('/api/ai/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Breakdown failed");
    }
    return res.json();
  };

  const handlePrioritizeProjectsAI = async (items: any[], context?: string) => {
    const res = await fetch('/api/ai/prioritize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, context })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Prioritization failed");
    }
    return res.json();
  };

  const handleGenerateWhatsAppDraft = async (type: string, data: any) => {
    const res = await fetch('/api/ai/draft-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "WhatsApp drafting failed");
    }
    const result = await res.json();
    return result.draft;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center space-y-3 font-mono text-sm text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
        <span>Chargement de la session sécurisée...</span>
      </div>
    );
  }

  // Not logged in: Show elegant, clean portal interface
  if (!user) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between" id="auth-portal-view">
        {/* Portal Header */}
        <header className="max-w-7xl mx-auto w-full px-6 py-6 flex justify-between items-center border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600 rounded-xl text-white font-sans font-bold text-sm tracking-tight shadow-sm">
              TB
            </span>
            <span className="text-sm font-bold text-gray-900 font-sans tracking-tight">
              Tableau de Bord de Planification
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure Cloud
          </div>
        </header>

        {/* Portal Hero Main */}
        <main className="max-w-xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center space-y-8 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 font-sans tracking-tight leading-tight">
              Planifiez vos journées.<br />
              <span className="text-indigo-600">Priorisez vos grands projets.</span>
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto">
              Un tableau de bord moderne, intuitif et sécurisé pour décomposer vos ambitions à long terme et orchestrer votre productivité quotidienne avec l'aide de l'IA.
            </p>
          </div>

          {/* Integration highlights cards */}
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-indigo-600 font-mono uppercase tracking-wider">CALENDRIER</span>
              <p className="text-xs font-semibold text-gray-800">Synchronisé .ics</p>
              <p className="text-[10px] text-gray-400">Exportez en un clic vers Google Calendar.</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-wider">MESSAGERIE</span>
              <p className="text-xs font-semibold text-gray-800">Intégré WhatsApp</p>
              <p className="text-[10px] text-gray-400">Rappels et plannings rédigés par l'IA.</p>
            </div>
          </div>

          {/* Secure Login buttons */}
          <div className="space-y-4 max-w-sm mx-auto w-full pt-4">
            {authError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 text-left space-y-2" id="auth-error-notice">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  Mode Invité Cloud indisponible
                </p>
                <p className="text-[11px] leading-relaxed text-amber-700">
                  L'authentification invité anonyme est désactivée dans la console Firebase. Pas d'inquiétude ! Vous pouvez utiliser l'application immédiatement et en toute sécurité avec le mode local.
                </p>
              </div>
            )}

            <button
              id="btn-google-sign-in"
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-1.14 2.78-2.4 3.63v3.02h3.89c2.28-2.1 3.56-5.19 3.56-8.5z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.89-3.02c-1.08.72-2.46 1.16-4.04 1.16-3.11 0-5.74-2.1-6.68-4.96H1.21v3.11C3.18 21.88 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.32 14.27A7.16 7.16 0 0 1 4.9 12c0-.79.13-1.57.39-2.27V6.62H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.38l4.11-3.11z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.38l4.11 3.11c.94-2.86 3.57-4.96 6.68-4.96z"/>
              </svg>
              Se connecter avec Google
            </button>
            <button
              id="btn-anonymous-sign-in"
              onClick={handleGuestSignIn}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer font-sans"
            >
              Essayer en mode Invité Cloud
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-3 text-gray-400 text-[10px] font-mono">OU</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <button
              id="btn-local-mode-direct"
              onClick={handleEnableLocalMode}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              Continuer en Mode Local Sécurisé (Hors-ligne)
            </button>
          </div>
        </main>

        {/* Portal Footer */}
        <footer className="max-w-7xl mx-auto w-full px-6 py-8 text-center text-xs text-gray-400 font-mono border-t border-gray-100">
          <span>Plateforme conforme RGPD • Cryptage AES-256 Cloud Firestore</span>
        </footer>
      </div>
    );
  }

  // Logged In: Show main application interface with Sidebar navigation
  const sidebarItems = [
    { id: 'dashboard', label: 'Vue Globale', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tâches Quotidiennes', icon: CheckSquare },
    { id: 'projects', label: 'Projets Long Terme', icon: FolderKanban },
    { id: 'calendar', label: 'Mon Agenda', icon: CalendarDays },
    { id: 'reminders', label: 'Rappels & WhatsApp', icon: BellRing },
  ];

  const renderViewContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardOverview
            tasks={tasks}
            projects={projects}
            reminders={reminders}
            onToggleTask={(taskId, status) => handleUpdateTask(taskId, {
              status: status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED
            })}
            onNavigate={(view) => setCurrentView(view)}
            userName={user.displayName || (user.isAnonymous ? "Invité Anonyme" : user.email?.split('@')[0] || "Planificateur")}
          />
        );
      case 'tasks':
        return (
          <TaskPlanner
            tasks={tasks}
            projects={projects}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onGenerateWhatsAppDraft={handleGenerateWhatsAppDraft}
          />
        );
      case 'projects':
        return (
          <ProjectList
            projects={projects}
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onAddBatchTasks={handleAddBatchTasks}
            onBreakdownProjectAI={handleBreakdownProjectAI}
            onPrioritizeProjectsAI={handlePrioritizeProjectsAI}
          />
        );
      case 'calendar':
        return (
          <Calendar
            tasks={tasks}
            projects={projects}
            onAddTask={(date) => {
              setCurrentView('tasks');
            }}
            onSelectTask={(task) => {
              setCurrentView('tasks');
            }}
          />
        );
      case 'reminders':
        return (
          <ReminderManager
            reminders={reminders}
            tasks={tasks}
            projects={projects}
            onAddReminder={handleAddReminder}
            onDeleteReminder={handleDeleteReminder}
            onUpdateReminder={handleUpdateReminder}
            onGenerateWhatsAppDraft={handleGenerateWhatsAppDraft}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row" id="applet-main-layout">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-slate-900 text-slate-300 border-r border-slate-800 p-5 space-y-8 shrink-0">
        <div className="space-y-6">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <span className="p-1.5 bg-indigo-600 rounded-lg text-white font-bold text-xs shadow-sm">
              TB
            </span>
            <div>
              <p className="text-xs font-extrabold text-white font-sans tracking-tight leading-none">
                Tableau de Bord
              </p>
              <p className="text-[9px] text-indigo-400 font-mono mt-1">
                Planification IA
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-link-${item.id}`}
                  onClick={() => setCurrentView(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Account footer */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
              {user.uid === 'local-user' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Mode Local Actif
                </>
              ) : (
                "Compte Sécurisé"
              )}
            </p>
            <p className="text-xs text-white font-medium truncate">
              {user.uid === 'local-user' ? "Utilisateur Local Hors-ligne" : (user.displayName || (user.isAnonymous ? "Profil Invité" : user.email))}
            </p>
            {user.uid === 'local-user' && (
              <p className="text-[10px] text-slate-400">
                Données stockées sur ce navigateur
              </p>
            )}
          </div>
          <button
            id="btn-sign-out"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-1.5 border border-slate-800 hover:border-slate-700 rounded-lg text-[11px] text-slate-400 hover:text-white transition font-semibold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Header (Mobile navigation view) */}
      <header className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-slate-300 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="p-1 bg-indigo-600 rounded text-white font-bold text-xs">
            TB
          </span>
          <span className="text-xs font-bold text-white tracking-tight">
            Planification IA
          </span>
        </div>

        <button
          id="btn-mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Menu overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm pt-14" id="mobile-menu-drawer">
          <div className="bg-slate-900 p-6 space-y-6 max-h-[85vh] overflow-y-auto border-b border-slate-800">
            <nav className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`mobile-nav-link-${item.id}`}
                    onClick={() => {
                      setCurrentView(item.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>{user.uid === 'local-user' ? "Mode Local Actif" : (user.isAnonymous ? "Invité Anonyme" : user.email)}</span>
              <button
                id="btn-mobile-sign-out"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="text-rose-400 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Pane */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full space-y-6" id="applet-view-content">
        {user && user.uid === 'local-user' && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-indigo-900 shadow-sm" id="local-mode-banner">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse shrink-0" />
              <div>
                <span className="font-bold">Mode Local Sécurisé Actif :</span> Vos données sont enregistrées en toute sécurité dans ce navigateur.
              </div>
            </div>
            <button
              onClick={handleGoogleSignIn}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              Sauvegarder dans le Cloud avec Google
            </button>
          </div>
        )}

        {firestoreError && user && user.uid !== 'local-user' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex justify-between items-center text-xs text-amber-800 shadow-sm" id="firestore-offline-banner">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
              <span>{firestoreError}</span>
            </div>
            <button 
              onClick={handleEnableLocalMode}
              className="text-[10px] font-bold underline cursor-pointer shrink-0 hover:text-amber-950"
            >
              Basculer en Mode Local Pur
            </button>
          </div>
        )}

        {renderViewContent()}
      </main>
    </div>
  );
}
