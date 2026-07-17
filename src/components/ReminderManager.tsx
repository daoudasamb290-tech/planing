import React, { useState } from 'react';
import { Bell, Plus, Calendar, Clock, MessageSquare, Send, Trash2, Check, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { Reminder, ReminderChannel, Task, Project } from '../types';

interface ReminderManagerProps {
  reminders: Reminder[];
  tasks: Task[];
  projects: Project[];
  onAddReminder: (reminderData: Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteReminder: (reminderId: string) => Promise<void>;
  onUpdateReminder: (reminderId: string, updates: Partial<Reminder>) => Promise<void>;
  onGenerateWhatsAppDraft: (type: string, data: any) => Promise<string>;
}

export default function ReminderManager({
  reminders,
  tasks,
  projects,
  onAddReminder,
  onDeleteReminder,
  onUpdateReminder,
  onGenerateWhatsAppDraft
}: ReminderManagerProps) {
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState('');
  const [type, setType] = useState<'task' | 'project' | 'custom'>('custom');
  const [targetId, setTargetId] = useState('');
  const [channel, setChannel] = useState<ReminderChannel>(ReminderChannel.WHATSAPP);

  // WhatsApp Drafting states
  const [activeDraftReminder, setActiveDraftReminder] = useState<Reminder | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);

  // Filter out completed tasks or active projects
  const activeTasksForSelect = tasks.filter(t => t.status !== 'completed');
  const activeProjectsForSelect = projects.filter(p => p.status !== 'completed');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !datetime) return;

    try {
      await onAddReminder({
        title,
        datetime,
        type,
        targetId: targetId || undefined,
        channel,
        sent: false
      });

      // Reset form
      setTitle('');
      setDatetime('');
      setType('custom');
      setTargetId('');
      setChannel(ReminderChannel.WHATSAPP);
      setShowForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Adjust title based on selected task or project
  const handleTypeOrTargetChange = (newType: 'task' | 'project' | 'custom', targetVal: string) => {
    setType(newType);
    setTargetId(targetVal);

    if (newType === 'task' && targetVal) {
      const task = tasks.find(t => t.id === targetVal);
      if (task) {
        setTitle(`Rappel Échéance : ${task.title}`);
        if (task.date) {
          const timePart = task.time || "09:00";
          setDatetime(`${task.date}T${timePart}`);
        }
      }
    } else if (newType === 'project' && targetVal) {
      const project = projects.find(p => p.id === targetVal);
      if (project) {
        setTitle(`Échéance Projet : ${project.title}`);
        if (project.targetDate) {
          setDatetime(`${project.targetDate}T09:00`);
        }
      }
    }
  };

  // Trigger Gemini WhatsApp reminder composer
  const triggerDraftingAI = async (reminder: Reminder) => {
    setActiveDraftReminder(reminder);
    setIsDrafting(true);
    setDraftText('');
    setShowDraftModal(true);

    try {
      let targetDetails = "Rappel général personnalisé.";
      if (reminder.type === 'task' && reminder.targetId) {
        const task = tasks.find(t => t.id === reminder.targetId);
        if (task) {
          targetDetails = `Tâche : ${task.title}. Échéance : ${task.date} à ${task.time || 'non spécifiée'}. Description : ${task.description || 'aucune'}`;
        }
      } else if (reminder.type === 'project' && reminder.targetId) {
        const project = projects.find(p => p.id === reminder.targetId);
        if (project) {
          targetDetails = `Projet à long terme : ${project.title}. Échéance finale : ${project.targetDate || 'non définie'}. Description : ${project.description || 'aucune'}`;
        }
      }

      const draft = await onGenerateWhatsAppDraft('reminder', {
        title: reminder.title,
        datetime: reminder.datetime,
        channel: reminder.channel,
        details: targetDetails
      });

      setDraftText(draft);
    } catch (err) {
      console.error(err);
      setDraftText("Impossible de rédiger automatiquement le rappel par l'IA.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSendWhatsApp = async (reminder: Reminder, customText: string) => {
    const textToSend = customText || `🚨 Rappel important : ${reminder.title} planifié pour le ${new Date(reminder.datetime).toLocaleString('fr-FR')}`;
    const encoded = encodeURIComponent(textToSend);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');

    // Mark reminder as sent/processed
    await onUpdateReminder(reminder.id, { sent: true });
    setShowDraftModal(false);
  };

  return (
    <div className="space-y-6" id="reminder-manager-section">
      {/* Alert Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" id="reminder-banner">
        <div className="flex gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Bell className="w-6 h-6 animate-swing" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-sans tracking-tight">
              Centre de Rappels et Échéances
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Ne manquez plus aucune échéance. Configurez des rappels instantanés ou générez des messages WhatsApp à vous envoyer ou à partager en 1 clic.
            </p>
          </div>
        </div>
        <button
          id="btn-trigger-new-reminder"
          onClick={() => setShowForm(!showForm)}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Configurer un rappel
        </button>
      </div>

      {/* Reminder Creation Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4" id="reminder-creation-form">
          <h3 className="text-base font-bold text-gray-900 font-sans tracking-tight">
            Nouveau Rappel de Sécurité & Échéance
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">LIER À UN ÉLÉMENT</label>
              <select
                id="reminder-form-type"
                value={type}
                onChange={e => handleTypeOrTargetChange(e.target.value as any, '')}
                className="w-full px-3.5 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm text-gray-700 font-semibold"
              >
                <option value="custom">Rappel Général Personnalisé</option>
                <option value="task">Lier à une Tâche Quotidienne</option>
                <option value="project">Lier à un Projet Long Terme</option>
              </select>
            </div>

            {type === 'task' && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-gray-400 font-mono">SÉLECTIONNER LA TÂCHE *</label>
                <select
                  id="reminder-form-task-target"
                  required
                  value={targetId}
                  onChange={e => handleTypeOrTargetChange('task', e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm text-gray-700"
                >
                  <option value="">-- Choisissez une tâche --</option>
                  {activeTasksForSelect.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.date})</option>
                  ))}
                </select>
              </div>
            )}

            {type === 'project' && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-gray-400 font-mono">SÉLECTIONNER LE PROJET *</label>
                <select
                  id="reminder-form-proj-target"
                  required
                  value={targetId}
                  onChange={e => handleTypeOrTargetChange('project', e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm text-gray-700"
                >
                  <option value="">-- Choisissez un projet --</option>
                  {activeProjectsForSelect.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}

            {type === 'custom' && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-gray-400 font-mono">LIBELLÉ DU RAPPEL *</label>
                <input
                  id="reminder-form-title"
                  type="text"
                  required
                  placeholder="Ex: Appeler le client, relire ma priorisation..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">DATE ET HEURE DU RAPPEL *</label>
              <input
                id="reminder-form-datetime"
                type="datetime-local"
                required
                value={datetime}
                onChange={e => setDatetime(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">CANAL DE TRANSMISSION *</label>
              <select
                id="reminder-form-channel"
                value={channel}
                onChange={e => setChannel(e.target.value as ReminderChannel)}
                className="w-full px-3.5 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm text-gray-700 font-semibold"
              >
                <option value={ReminderChannel.WHATSAPP}>WhatsApp Link 💬</option>
                <option value={ReminderChannel.IN_APP}>Notification In-App 🔔</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              id="reminder-form-cancel"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              id="reminder-form-submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              Enregistrer le rappel
            </button>
          </div>
        </form>
      )}

      {/* Reminders List display */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" id="reminders-table-container">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 font-mono">LISTE DES RAPPELS PLANIFIÉS</span>
          <span className="text-xs text-gray-400 font-mono">{reminders.length} Actif(s)</span>
        </div>

        {reminders.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-sans">Aucun rappel planifié pour le moment.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
            >
              Créer un rappel
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reminders.map(reminder => {
              const dateObj = new Date(reminder.datetime);
              const formattedDate = dateObj.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });
              const formattedTime = dateObj.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              });

              const isPassed = dateObj.getTime() < Date.now();

              return (
                <div
                  key={reminder.id}
                  id={`reminder-item-${reminder.id}`}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition ${
                    reminder.sent ? 'bg-gray-50/30 opacity-70' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                      isPassed ? 'bg-gray-100 text-gray-400' : 'bg-rose-50 text-rose-500'
                    }`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className={`text-sm font-semibold text-gray-800 ${reminder.sent ? 'line-through text-gray-400' : ''}`}>
                        {reminder.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {formattedDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {formattedTime}
                        </span>
                        <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                          {reminder.channel === ReminderChannel.WHATSAPP ? 'WhatsApp 💬' : 'App 🔔'}
                        </span>
                        {isPassed && !reminder.sent && (
                          <span className="text-rose-500 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Échéance dépassée
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {reminder.channel === ReminderChannel.WHATSAPP && (
                      <button
                        id={`btn-draft-wa-${reminder.id}`}
                        onClick={() => triggerDraftingAI(reminder)}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                        title="Rédiger et envoyer un rappel par WhatsApp"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        Générer WhatsApp
                      </button>
                    )}

                    {reminder.channel === ReminderChannel.IN_APP && !reminder.sent && (
                      <button
                        id={`btn-complete-reminder-${reminder.id}`}
                        onClick={() => onUpdateReminder(reminder.id, { sent: true })}
                        className="p-1.5 bg-gray-50 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition"
                        title="Marquer comme notifié/lu"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      id={`btn-delete-reminder-${reminder.id}`}
                      onClick={() => onDeleteReminder(reminder.id)}
                      className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition"
                      title="Supprimer le rappel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI WhatsApp drafting modal */}
      {showDraftModal && activeDraftReminder && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="reminder-draft-modal">
          <div className="bg-white rounded-2xl border border-gray-100 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <Sparkles className="w-5 h-5 text-emerald-600 animate-spin-slow" />
              <h3 className="text-lg font-bold text-gray-900 font-sans tracking-tight">
                Rappel Intelligent WhatsApp par l'IA
              </h3>
            </div>

            <p className="text-xs text-gray-500">
              Gemini a analysé l'échéance et a rédigé ce rappel personnalisé. Vous pouvez l'éditer avant de l'envoyer :
            </p>

            {isDrafting ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 font-mono">Rédaction du rappel en cours...</p>
              </div>
            ) : (
              <textarea
                id="reminder-draft-editor"
                rows={10}
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                id="btn-close-reminder-modal"
                onClick={() => {
                  setShowDraftModal(false);
                  setActiveDraftReminder(null);
                }}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                id="btn-copy-reminder-text"
                onClick={() => {
                  navigator.clipboard.writeText(draftText);
                  alert("Rappel copié !");
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
              >
                Copier
              </button>
              <button
                type="button"
                id="btn-send-reminder-wa"
                disabled={isDrafting}
                onClick={() => handleSendWhatsApp(activeDraftReminder, draftText)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Envoyer WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
