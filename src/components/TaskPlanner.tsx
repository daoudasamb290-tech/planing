import React, { useState } from 'react';
import { Plus, CheckSquare, Square, Calendar, Clock, AlertCircle, Share2, Download, Trash2, Edit2, Sparkles, AlertTriangle, FileText } from 'lucide-react';
import { Task, Project, Priority, TaskStatus } from '../types';

interface TaskPlannerProps {
  tasks: Task[];
  projects: Project[];
  onAddTask: (taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  defaultDate?: string;
  onGenerateWhatsAppDraft: (type: string, data: any) => Promise<string>;
}

export default function TaskPlanner({
  tasks,
  projects,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  defaultDate,
  onGenerateWhatsAppDraft
}: TaskPlannerProps) {
  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'tomorrow' | 'week' | 'all'>('today');

  // New task form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [projectId, setProjectId] = useState('');

  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // WhatsApp Draft Modal state
  const [whatsappDraft, setWhatsappDraft] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getTomorrowStr = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const getStartOfWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(today.setDate(diff)).toISOString().split('T')[0];
  };

  const getEndOfWeek = () => {
    const today = new Date();
    const start = new Date(getStartOfWeek());
    const end = new Date(start.setDate(start.getDate() + 6));
    return end.toISOString().split('T')[0];
  };

  // Filter tasks based on selected constraints
  const filteredTasks = tasks.filter(task => {
    // Status filter
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;

    // Time filter
    const today = getTodayStr();
    const tomorrow = getTomorrowStr();
    const startOfWeek = getStartOfWeek();
    const endOfWeek = getEndOfWeek();

    if (timeFilter === 'today' && task.date !== today) return false;
    if (timeFilter === 'tomorrow' && task.date !== tomorrow) return false;
    if (timeFilter === 'week') {
      return task.date >= startOfWeek && task.date <= endOfWeek;
    }

    return true;
  });

  // Calculate statistics
  const todayTasks = tasks.filter(t => t.date === getTodayStr());
  const completedToday = todayTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const totalToday = todayTasks.length;
  const progressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    try {
      if (editingTaskId) {
        await onUpdateTask(editingTaskId, {
          title,
          description,
          date,
          time: time || undefined,
          priority,
          projectId: projectId || undefined,
        });
        setEditingTaskId(null);
      } else {
        await onAddTask({
          title,
          description,
          date,
          time: time || undefined,
          priority,
          status: TaskStatus.TODO,
          projectId: projectId || undefined,
        });
      }

      // Reset form
      setTitle('');
      setDescription('');
      setTime('');
      setPriority(Priority.MEDIUM);
      setProjectId('');
      setShowForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description || '');
    setDate(task.date);
    setTime(task.time || '');
    setPriority(task.priority);
    setProjectId(task.projectId || '');
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setTitle('');
    setDescription('');
    setTime('');
    setPriority(Priority.MEDIUM);
    setProjectId('');
    setShowForm(false);
  };

  // 1. Export Planning to iCal (ICS format) for sync
  const exportToICS = () => {
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Tableau de Bord de Planification//FR\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";

    filteredTasks.forEach(task => {
      const dateParts = task.date.split('-');
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];

      const timeParts = task.time ? task.time.split(':') : ['09', '00'];
      const hour = timeParts[0];
      const min = timeParts[1];

      // Formulate date strings
      const dtStart = `${year}${month}${day}T${hour}${min}00`;
      const dtEnd = `${year}${month}${day}T${String(Number(hour) + 1).padStart(2, '0')}${min}00`;

      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `UID:${task.id}@tableau-bord-planification.local\r\n`;
      icsContent += `DTSTAMP:${year}${month}${day}T000000Z\r\n`;
      icsContent += `DTSTART:${dtStart}\r\n`;
      icsContent += `DTEND:${dtEnd}\r\n`;
      icsContent += `SUMMARY:${task.title}\r\n`;
      if (task.description) {
        icsContent += `DESCRIPTION:${task.description.replace(/\n/g, '\\n')}\r\n`;
      }
      icsContent += `PRIORITY:${task.priority === Priority.URGENT || task.priority === Priority.HIGH ? 1 : 5}\r\n`;
      icsContent += "END:VEVENT\r\n";
    });

    icsContent += "END:VCALENDAR\r\n";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `planning-${timeFilter}-${new Date().toISOString().split('T')[0]}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Draft Daily Summary & WhatsApp share link
  const triggerWhatsAppDraft = async () => {
    setIsGeneratingDraft(true);
    try {
      const today = getTodayStr();
      const dayTasks = tasks.filter(t => t.date === today);
      const dataForDraft = {
        date: today,
        tasks: dayTasks.map(t => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          time: t.time || 'Non spécifié'
        }))
      };

      const draft = await onGenerateWhatsAppDraft('daily_plan', dataForDraft);
      setWhatsappDraft(draft);
      setShowDraftModal(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const sendWhatsApp = () => {
    const encodedText = encodeURIComponent(whatsappDraft);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  return (
    <div className="space-y-6" id="task-planner-section">
      {/* Progression Banner */}
      <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4" id="task-banner">
        <div>
          <span className="bg-indigo-500/50 text-[10px] uppercase font-mono font-bold px-2 py-1 rounded-md">
            Productivité quotidienne
          </span>
          <h2 className="text-xl font-bold font-sans tracking-tight mt-1.5">
            Planning d'Aujourd'hui
          </h2>
          <p className="text-sm text-indigo-100 mt-1 max-w-md">
            {totalToday === 0
              ? "Aucune tâche planifiée pour aujourd'hui. Profitez-en pour planifier votre journée !"
              : `Vous avez complété ${completedToday} sur ${totalToday} tâches planifiées pour aujourd'hui.`}
          </p>
        </div>
        {totalToday > 0 && (
          <div className="w-full md:w-48">
            <div className="flex justify-between items-center text-xs font-mono font-semibold mb-1">
              <span>Complété</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-indigo-700/50 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Control Actions Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm" id="planner-controls">
        {/* Filters Grid */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter */}
          <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
            {(['today', 'tomorrow', 'week', 'all'] as const).map(filter => (
              <button
                key={filter}
                id={`btn-time-filter-${filter}`}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  timeFilter === filter
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {filter === 'today' ? "Aujourd'hui" : filter === 'tomorrow' ? 'Demain' : filter === 'week' ? 'Cette semaine' : 'Tout'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
            {(['all', 'todo', 'in_progress', 'completed'] as const).map(filter => (
              <button
                key={filter}
                id={`btn-status-filter-${filter}`}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  statusFilter === filter
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {filter === 'all' ? 'Toutes' : filter === 'todo' ? 'À faire' : filter === 'in_progress' ? 'En cours' : 'Terminées'}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Buttons */}
        <div className="flex items-center gap-2">
          {filteredTasks.length > 0 && (
            <button
              id="btn-export-ics"
              onClick={exportToICS}
              className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              title="Exporter au format .ics pour Google Calendar/Outlook"
            >
              <Download className="w-3.5 h-3.5" /> Exporter .ics
            </button>
          )}
          {timeFilter === 'today' && totalToday > 0 && (
            <button
              id="btn-whatsapp-planning"
              disabled={isGeneratingDraft}
              onClick={triggerWhatsAppDraft}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {isGeneratingDraft ? (
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              Partager WhatsApp
            </button>
          )}
          <button
            id="btn-trigger-new-task"
            onClick={() => {
              if (showForm) {
                handleCancelEdit();
              } else {
                setShowForm(true);
              }
            }}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Nouvelle tâche
          </button>
        </div>
      </div>

      {/* Task Creation/Editing Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4" id="task-planner-form">
          <h3 className="text-base font-bold text-gray-900 font-sans tracking-tight flex items-center gap-2">
            {editingTaskId ? <Edit2 className="w-4 h-4 text-indigo-600" /> : <Plus className="w-4 h-4 text-indigo-600" />}
            {editingTaskId ? "Modifier la Tâche" : "Planifier une Nouvelle Tâche"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">TITRE DE LA TÂCHE *</label>
              <input
                id="task-form-title"
                type="text"
                required
                placeholder="Rédiger le rapport financier, séance de sport..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">PROJET ASSOCIÉ (OPTIONNEL)</label>
              <select
                id="task-form-project"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm text-gray-700"
              >
                <option value="">Aucun projet</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 font-mono">DESCRIPTION</label>
            <textarea
              id="task-form-desc"
              rows={2}
              placeholder="Ajouter des notes, des liens ou des étapes clés..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">DATE *</label>
              <input
                id="task-form-date"
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">HEURE (OPTIONNEL)</label>
              <input
                id="task-form-time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">PRIORITÉ *</label>
              <select
                id="task-form-priority"
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="w-full px-3.5 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm font-semibold"
              >
                <option value={Priority.LOW}>Basse 🟢</option>
                <option value={Priority.MEDIUM}>Moyenne 🟡</option>
                <option value={Priority.HIGH}>Haute 🟠</option>
                <option value={Priority.URGENT}>Urgente 🔴</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              id="task-form-cancel"
              onClick={editingTaskId ? handleCancelEdit : () => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              id="task-form-submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              {editingTaskId ? "Enregistrer" : "Créer la tâche"}
            </button>
          </div>
        </form>
      )}

      {/* Task List Grid */}
      <div className="space-y-3" id="task-list-grid">
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-sans text-sm">
              Aucune tâche ne correspond à vos filtres de planification.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Créer une tâche maintenant
            </button>
          </div>
        ) : (
          filteredTasks.map(task => {
            const project = projects.find(p => p.id === task.projectId);
            const isCompleted = task.status === TaskStatus.COMPLETED;

            const priorityStyles = {
              low: { bg: 'bg-emerald-50 border-emerald-100 text-emerald-700', label: 'Basse' },
              medium: { bg: 'bg-amber-50 border-amber-100 text-amber-700', label: 'Moyenne' },
              high: { bg: 'bg-orange-50 border-orange-100 text-orange-700', label: 'Haute' },
              urgent: { bg: 'bg-rose-50 border-rose-100 text-rose-700', label: 'Urgente' },
            };

            const styles = priorityStyles[task.priority];

            return (
              <div
                key={task.id}
                id={`task-card-${task.id}`}
                className={`bg-white rounded-xl border p-4 shadow-sm transition-all flex items-start justify-between gap-4 ${
                  isCompleted ? 'border-gray-100 bg-gray-50/40 opacity-70' : 'border-gray-100 hover:border-indigo-100'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    id={`btn-complete-task-${task.id}`}
                    onClick={() => onUpdateTask(task.id, {
                      status: isCompleted ? TaskStatus.TODO : TaskStatus.COMPLETED
                    })}
                    className="mt-0.5 text-gray-400 hover:text-indigo-600 transition shrink-0"
                  >
                    {isCompleted ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={`text-sm font-semibold text-gray-800 ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                        {task.title}
                      </h4>
                      {project && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold font-mono uppercase tracking-wider">
                          📁 {project.title}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className={`text-xs text-gray-500 line-clamp-2 ${isCompleted ? 'line-through text-gray-300' : ''}`}>
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {task.date === getTodayStr() ? "Aujourd'hui" : task.date === getTomorrowStr() ? 'Demain' : task.date}
                      </span>
                      {task.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {task.time}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles.bg}`}>
                    {styles.label}
                  </span>
                  <button
                    id={`btn-edit-task-${task.id}`}
                    onClick={() => handleEdit(task)}
                    className="p-1.5 hover:bg-gray-50 text-gray-500 hover:text-gray-900 rounded-lg transition"
                    title="Modifier la tâche"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id={`btn-delete-task-${task.id}`}
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition"
                    title="Supprimer la tâche"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* WhatsApp Custom Draft Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="whatsapp-draft-modal">
          <div className="bg-white rounded-2xl border border-gray-100 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <Share2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-gray-900">
                Aperçu du Planning pour WhatsApp
              </h3>
            </div>

            <p className="text-xs text-gray-500">
              Voici le brouillon généré par l'IA. Vous pouvez le copier ou l'envoyer directement via WhatsApp Web ou mobile :
            </p>

            <textarea
              id="whatsapp-draft-editor"
              rows={12}
              value={whatsappDraft}
              onChange={e => setWhatsappDraft(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                id="btn-close-draft-modal"
                onClick={() => setShowDraftModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
              >
                Fermer
              </button>
              <button
                type="button"
                id="btn-copy-draft"
                onClick={() => {
                  navigator.clipboard.writeText(whatsappDraft);
                  alert("Brouillon copié dans le presse-papiers !");
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
              >
                Copier le texte
              </button>
              <button
                type="button"
                id="btn-share-whatsapp-send"
                onClick={sendWhatsApp}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                Ouvrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
