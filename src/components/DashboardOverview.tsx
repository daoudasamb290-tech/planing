import React from 'react';
import { CheckSquare, Square, Calendar, Bell, Folder, AlertTriangle, TrendingUp, ShieldCheck, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Task, Project, Reminder, TaskStatus } from '../types';

interface DashboardOverviewProps {
  tasks: Task[];
  projects: Project[];
  reminders: Reminder[];
  onToggleTask: (taskId: string, currentStatus: TaskStatus) => void;
  onNavigate: (view: 'tasks' | 'projects' | 'calendar' | 'reminders') => void;
  userName: string;
}

export default function DashboardOverview({
  tasks,
  projects,
  reminders,
  onToggleTask,
  onNavigate,
  userName
}: DashboardOverviewProps) {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  // Calculations
  const todayTasks = tasks.filter(t => t.date === getTodayStr());
  const completedToday = todayTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const totalToday = todayTasks.length;
  const taskProgress = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const activeProjects = projects.filter(p => p.status !== 'completed');
  const pendingReminders = reminders.filter(r => !r.sent);

  // Recharts Data: priority distribution
  const priorityCounts = { low: 0, medium: 0, high: 0, urgent: 0 };
  tasks.forEach(t => {
    if (t.status !== TaskStatus.COMPLETED) {
      priorityCounts[t.priority]++;
    }
  });

  const chartData = [
    { name: 'Basse', valeur: priorityCounts.low, color: '#34d399' },
    { name: 'Moyenne', valeur: priorityCounts.medium, color: '#fbbf24' },
    { name: 'Haute', valeur: priorityCounts.high, color: '#f97316' },
    { name: 'Urgente', valeur: priorityCounts.urgent, color: '#f43f5e' },
  ];

  // Next upcoming reminders (within the next 48h or soonest)
  const sortedUpcomingReminders = reminders
    .filter(r => !r.sent && new Date(r.datetime).getTime() >= Date.now())
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    .slice(0, 3);

  // Top pending high priority tasks
  const highPriorityPendingTasks = tasks
    .filter(t => t.status !== TaskStatus.COMPLETED && (t.priority === 'high' || t.priority === 'urgent'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  return (
    <div className="space-y-6" id="dashboard-overview-container">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6" id="welcome-banner">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-bold text-indigo-300 font-mono uppercase tracking-wider">
              Tableau de bord intelligent
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight font-sans">
            Bonjour, {userName || "Planificateur"}
          </h2>
          <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
            Bienvenue dans votre espace sécurisé. Organisez votre journée, priorisez vos jalons à long terme et optimisez vos transmissions WhatsApp sans effort.
          </p>
        </div>

        {/* Security badge statement */}
        <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl flex items-start gap-2.5 max-w-xs shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-white font-sans">Données Sécurisées</p>
            <p className="text-[11px] text-slate-400 font-mono">
              Chiffrement de bout en bout et isolation complète sous votre compte Firestore.
            </p>
          </div>
        </div>
      </div>

      {/* Grid Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-cards-grid">
        {/* Card 1 */}
        <div
          onClick={() => onNavigate('tasks')}
          className="bg-white border border-gray-100 hover:border-indigo-100 p-5 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 font-mono uppercase">TÂCHES AUJOURD'HUI</span>
            <p className="text-2xl font-bold text-gray-900 font-sans">
              {completedToday}/{totalToday}
            </p>
            <span className="text-[11px] text-gray-400 font-medium">
              {totalToday > 0 ? `${taskProgress}% complété` : "Aucune tâche planifiée"}
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div
          onClick={() => onNavigate('projects')}
          className="bg-white border border-gray-100 hover:border-indigo-100 p-5 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 font-mono uppercase">PROJETS ACTIFS</span>
            <p className="text-2xl font-bold text-gray-900 font-sans">
              {activeProjects.length}
            </p>
            <span className="text-[11px] text-gray-400 font-medium">
              Objectifs à long terme
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Folder className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div
          onClick={() => onNavigate('reminders')}
          className="bg-white border border-gray-100 hover:border-indigo-100 p-5 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 font-mono uppercase">RAPPELS ACTIFS</span>
            <p className="text-2xl font-bold text-gray-900 font-sans">
              {pendingReminders.length}
            </p>
            <span className="text-[11px] text-gray-400 font-medium">
              Système d'alertes WhatsApp
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div
          onClick={() => onNavigate('calendar')}
          className="bg-white border border-gray-100 hover:border-indigo-100 p-5 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 font-mono uppercase">VUE CALENDRIER</span>
            <p className="text-2xl font-bold text-gray-900 font-sans">
              Planner
            </p>
            <span className="text-[11px] text-gray-400 font-medium">
              Deadlines & jalons synchronisés
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main content grid: Left graph, Right dynamic logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-mid-row">
        {/* Left Priority graph */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between h-full" id="priority-chart-panel">
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800 uppercase font-mono">
                Répartition des Tâches Actives par Priorité
              </h3>
            </div>
            <p className="text-xs text-gray-400">
              Visualisez la charge et la sévérité de vos tâches courantes à accomplir.
            </p>
          </div>

          <div className="h-[220px] w-full" id="recharts-bar-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6', radius: 4 }}
                  contentStyle={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #f3f4f6', fontSize: '12px' }}
                />
                <Bar dataKey="valeur" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right upcoming alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between" id="upcoming-reminders-panel">
          <div className="space-y-4">
            <div className="space-y-1 pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 uppercase font-mono flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-rose-500" /> RAPPELS À VENIR (48H)
              </h3>
              <p className="text-xs text-gray-400">Vos prochaines échéances critiques.</p>
            </div>

            <div className="space-y-3">
              {sortedUpcomingReminders.length === 0 ? (
                <div className="text-center py-10">
                  <Bell className="w-8 h-8 text-gray-200 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">Aucun rappel imminent planifié.</p>
                </div>
              ) : (
                sortedUpcomingReminders.map(rem => {
                  const dateStr = new Date(rem.datetime).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={rem.id}
                      className="p-3 bg-rose-50/40 rounded-xl border border-rose-50/70 flex items-start gap-2.5 text-xs cursor-pointer hover:bg-rose-50/60 transition"
                      onClick={() => onNavigate('reminders')}
                    >
                      <span className="mt-0.5">🔔</span>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-gray-800">{rem.title}</p>
                        <p className="text-[10px] text-rose-600 font-mono">{dateStr}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            id="btn-navigate-reminders"
            onClick={() => onNavigate('reminders')}
            className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold text-xs rounded-xl transition mt-4"
          >
            Gérer mes alertes
          </button>
        </div>
      </div>

      {/* Daily urgent tasks checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4" id="urgent-tasks-checklist">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-800 uppercase font-mono flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> TÂCHES DE HAUTE PRIORITÉ NON COMPLÉTÉES
            </h3>
            <p className="text-xs text-gray-400">Accomplissez ces tâches urgentes en priorité pour débloquer vos projets.</p>
          </div>
          <button
            id="btn-navigate-all-tasks"
            onClick={() => onNavigate('tasks')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Voir tout
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {highPriorityPendingTasks.length === 0 ? (
            <div className="md:col-span-2 text-center py-6">
              <span className="text-2xl">🎉</span>
              <p className="text-xs text-gray-400 mt-1">Excellent ! Aucune tâche prioritaire en retard.</p>
            </div>
          ) : (
            highPriorityPendingTasks.map(task => (
              <div
                key={task.id}
                id={`dashboard-task-card-${task.id}`}
                className="p-3 bg-gray-50/50 rounded-xl border border-gray-100 flex items-start justify-between gap-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <button
                    type="button"
                    id={`btn-toggle-dash-task-${task.id}`}
                    onClick={() => onToggleTask(task.id, task.status)}
                    className="mt-0.5 text-gray-400 hover:text-indigo-600 transition shrink-0"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{task.title}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">Date limite : {task.date}</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                  task.priority === 'urgent' ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {task.priority === 'urgent' ? 'Urgente' : 'Haute'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
