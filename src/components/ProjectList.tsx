import React, { useState } from 'react';
import { Plus, Folder, Calendar, Flag, Sparkles, CheckSquare, Square, Trash2, ShieldAlert, BrainCircuit, Check, Edit3, ArrowRight } from 'lucide-react';
import { Project, Milestone, Priority, ProjectStatus, Task, TaskStatus } from '../types';

interface ProjectListProps {
  projects: Project[];
  onAddProject: (projectData: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onAddBatchTasks: (tasks: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  onBreakdownProjectAI: (title: string, description: string) => Promise<{
    suggestedMilestones: { title: string; targetOffsetDays: number }[];
    suggestedTasks: { title: string; description: string; priority: string }[];
  }>;
  onPrioritizeProjectsAI: (items: any[], context?: string) => Promise<{
    prioritizedItems: { id: string; priorityScore: number; recommendedPriority: string; rationale: string }[];
  }>;
}

export default function ProjectList({
  projects,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAddBatchTasks,
  onBreakdownProjectAI,
  onPrioritizeProjectsAI
}: ProjectListProps) {
  // UI states
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.PLANNING);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState('');

  // Milestone builder state
  const [milestonesText, setMilestonesText] = useState('');

  // AI Breakdown states
  const [activeBreakdownProjectId, setActiveBreakdownProjectId] = useState<string | null>(null);
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [aiBreakdownResult, setAiBreakdownResult] = useState<{
    projectId: string;
    suggestedMilestones: { title: string; targetOffsetDays: number }[];
    suggestedTasks: { title: string; description: string; priority: string }[];
  } | null>(null);

  // AI Prioritization states
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [prioritizationContext, setPrioritizationContext] = useState('');
  const [aiPrioritizationResult, setAiPrioritizationResult] = useState<any[] | null>(null);
  const [showPrioritizerModal, setShowPrioritizerModal] = useState(false);

  // Add Project Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Build milestones from text input
    const milestoneLines = milestonesText.split('\n').filter(line => line.trim() !== '');
    const generatedMilestones: Milestone[] = milestoneLines.map((line, idx) => {
      // Set milestone deadline to some days from today for simulation
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + (idx + 1) * 7);

      return {
        id: `m-${Date.now()}-${idx}`,
        title: line.trim(),
        date: deadline.toISOString().split('T')[0],
        completed: false
      };
    });

    try {
      await onAddProject({
        title,
        description,
        priority,
        status,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
        milestones: generatedMilestones
      });

      // Reset
      setTitle('');
      setDescription('');
      setPriority(Priority.MEDIUM);
      setStatus(ProjectStatus.PLANNING);
      setStartDate(new Date().toISOString().split('T')[0]);
      setTargetDate('');
      setMilestonesText('');
      setShowForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle milestone checkbox
  const handleToggleMilestone = async (project: Project, milestoneId: string) => {
    const updatedMilestones = (project.milestones || []).map(m => {
      if (m.id === milestoneId) {
        return { ...m, completed: !m.completed };
      }
      return m;
    });

    // Check if all are completed
    const allCompleted = updatedMilestones.length > 0 && updatedMilestones.every(m => m.completed);
    const newStatus = allCompleted ? ProjectStatus.COMPLETED : project.status;

    await onUpdateProject(project.id, {
      milestones: updatedMilestones,
      status: newStatus
    });
  };

  // Trigger Gemini Breakdown (milestones and tasks breakdown)
  const triggerBreakdownAI = async (project: Project) => {
    setActiveBreakdownProjectId(project.id);
    setIsBreakingDown(true);
    setAiBreakdownResult(null);

    try {
      const result = await onBreakdownProjectAI(project.title, project.description || '');
      setAiBreakdownResult({
        projectId: project.id,
        suggestedMilestones: result.suggestedMilestones,
        suggestedTasks: result.suggestedTasks
      });
    } catch (err) {
      console.error(err);
      alert("Impossible de générer le découpage par l'IA.");
    } finally {
      setIsBreakingDown(false);
    }
  };

  // Apply AI Breakdown to database
  const applyBreakdownAI = async () => {
    if (!aiBreakdownResult) return;

    const project = projects.find(p => p.id === aiBreakdownResult.projectId);
    if (!project) return;

    try {
      // 1. Create milestones
      const newMilestones: Milestone[] = aiBreakdownResult.suggestedMilestones.map((sm, idx) => {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() + sm.targetOffsetDays);

        return {
          id: `m-ai-${Date.now()}-${idx}`,
          title: sm.title,
          targetOffsetDays: sm.targetOffsetDays,
          date: dateLimit.toISOString().split('T')[0],
          completed: false
        };
      });

      // Update project with the new milestones
      await onUpdateProject(project.id, {
        milestones: [...(project.milestones || []), ...newMilestones],
        status: ProjectStatus.ACTIVE
      });

      // 2. Create actual daily tasks in database
      const tasksToInsert = aiBreakdownResult.suggestedTasks.map(st => {
        const p = st.priority === 'high' ? Priority.HIGH : st.priority === 'low' ? Priority.LOW : Priority.MEDIUM;
        return {
          title: `${st.title} [${project.title}]`,
          description: st.description,
          date: new Date().toISOString().split('T')[0], // Assign to today for immediate planning
          priority: p,
          status: TaskStatus.TODO,
          projectId: project.id
        };
      });

      if (tasksToInsert.length > 0) {
        await onAddBatchTasks(tasksToInsert);
      }

      alert("Découpage IA appliqué avec succès ! Des jalons et des tâches de démarrage ont été ajoutés.");
      setAiBreakdownResult(null);
      setActiveBreakdownProjectId(null);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'application du découpage.");
    }
  };

  // Trigger Gemini Prioritizer for all projects
  const triggerPrioritizerAI = async () => {
    setIsPrioritizing(true);
    setAiPrioritizationResult(null);

    const activeProjects = projects.filter(p => p.status !== ProjectStatus.COMPLETED);
    if (activeProjects.length === 0) {
      alert("Aucun projet actif à prioriser.");
      setIsPrioritizing(false);
      return;
    }

    try {
      const itemsToAnalyze = activeProjects.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        currentPriority: p.priority,
        targetDate: p.targetDate || 'Non définie'
      }));

      const result = await onPrioritizeProjectsAI(itemsToAnalyze, prioritizationContext);
      setAiPrioritizationResult(result.prioritizedItems);
    } catch (err) {
      console.error(err);
      alert("Impossible de prioriser les projets avec l'IA.");
    } finally {
      setIsPrioritizing(false);
    }
  };

  // Apply AI Priorities to database
  const applyPrioritiesAI = async () => {
    if (!aiPrioritizationResult) return;

    try {
      for (const item of aiPrioritizationResult) {
        const matchedProj = projects.find(p => p.id === item.id);
        if (matchedProj) {
          await onUpdateProject(item.id, {
            priority: item.recommendedPriority as Priority
          });
        }
      }

      alert("Priorités optimisées appliquées à tous vos projets !");
      setAiPrioritizationResult(null);
      setShowPrioritizerModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" id="project-list-section">
      {/* Header and Strategic Priority Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4" id="project-header-row">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight">
            Projets à Long Terme & Objectifs
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Planifiez vos ambitions, définissez des jalons clés et laissez l'IA vous aider à structurer vos idées.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <button
              id="btn-ai-prioritizer"
              onClick={() => {
                setShowPrioritizerModal(true);
                triggerPrioritizerAI();
              }}
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <BrainCircuit className="w-4 h-4 text-indigo-600" />
              Prioriser avec l'IA
            </button>
          )}
          <button
            id="btn-trigger-new-project"
            onClick={() => setShowForm(!showForm)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Nouveau projet
          </button>
        </div>
      </div>

      {/* Project Creation Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4" id="project-creation-form">
          <h3 className="text-base font-bold text-gray-900 font-sans tracking-tight flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-600" /> Créer un Projet à Long Terme
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono">NOM DU PROJET *</label>
              <input
                id="proj-form-title"
                type="text"
                required
                placeholder="Ex: Lancer mon site e-commerce, Apprendre l'italien..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 font-mono">PRIORITÉ INIT *</label>
                <select
                  id="proj-form-priority"
                  value={priority}
                  onChange={e => setPriority(e.target.value as Priority)}
                  className="w-full px-3.5 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm text-gray-700 font-semibold"
                >
                  <option value={Priority.LOW}>Basse 🟢</option>
                  <option value={Priority.MEDIUM}>Moyenne 🟡</option>
                  <option value={Priority.HIGH}>Haute 🟠</option>
                  <option value={Priority.URGENT}>Urgente 🔴</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 font-mono">STATUT *</label>
                <select
                  id="proj-form-status"
                  value={status}
                  onChange={e => setStatus(e.target.value as ProjectStatus)}
                  className="w-full px-3.5 py-2 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm text-gray-700 font-semibold"
                >
                  <option value={ProjectStatus.PLANNING}>Planification</option>
                  <option value={ProjectStatus.ACTIVE}>Actif</option>
                  <option value={ProjectStatus.ON_HOLD}>En pause</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 font-mono">DESCRIPTION ET OBJECTIFS</label>
            <textarea
              id="proj-form-desc"
              rows={2}
              placeholder="Décrivez les résultats attendus, le but ultime et les critères de réussite..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 font-mono">DATE DE DÉBUT</label>
                <input
                  id="proj-form-start"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 font-mono">ÉCHÉANCE CIBLE</label>
                <input
                  id="proj-form-target"
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono flex items-center gap-1.5">
                JALONS INITIAUX (1 PAR LIGNE)
              </label>
              <textarea
                id="proj-form-milestones"
                rows={2}
                placeholder="Créer une maquette&#10;Acheter le nom de domaine&#10;Lancer la version bêta..."
                value={milestonesText}
                onChange={e => setMilestonesText(e.target.value)}
                className="w-full px-3.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              id="proj-form-cancel"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              id="proj-form-submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              Créer le projet
            </button>
          </div>
        </form>
      )}

      {/* Projects Grid Display */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <Folder className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-800">Aucun projet enregistré</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            Les projets à long terme vous aident à structurer vos tâches quotidiennes et à garder le cap sur vos grands objectifs.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
          >
            Créer mon premier projet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="projects-grid">
          {projects.map(project => {
            const milestones = project.milestones || [];
            const completedMilestones = milestones.filter(m => m.completed).length;
            const milestonesTotal = milestones.length;
            const projectProgress = milestonesTotal > 0 ? Math.round((completedMilestones / milestonesTotal) * 100) : 0;

            const priorityLabels = {
              low: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', text: 'Basse' },
              medium: { bg: 'bg-amber-50 text-amber-700 border-amber-100', text: 'Moyenne' },
              high: { bg: 'bg-orange-50 text-orange-700 border-orange-100', text: 'Haute' },
              urgent: { bg: 'bg-rose-50 text-rose-700 border-rose-100', text: 'Urgente' },
            };

            const statusLabels = {
              planning: 'En planification',
              active: 'Actif',
              on_hold: 'En pause',
              completed: 'Terminé',
            };

            return (
              <div
                key={project.id}
                id={`project-card-${project.id}`}
                className="bg-white border border-gray-100 hover:border-indigo-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 transition-all"
              >
                <div className="space-y-4">
                  {/* Title and Badges */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-base font-bold text-gray-900 font-sans tracking-tight">
                          {project.title}
                        </h4>
                      </div>
                      <span className="text-xs text-gray-400 font-mono block">
                        Statut : {statusLabels[project.status]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityLabels[project.priority].bg}`}>
                        {priorityLabels[project.priority].text}
                      </span>
                      <button
                        id={`btn-delete-proj-${project.id}`}
                        onClick={() => onDeleteProject(project.id)}
                        className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-md transition"
                        title="Supprimer le projet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-xs text-gray-500 line-clamp-3">
                      {project.description}
                    </p>
                  )}

                  {/* Milestones check list */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-gray-400 font-semibold font-mono">
                      <span>JALONS & SOUS-TÂCHES</span>
                      <span>{completedMilestones}/{milestonesTotal}</span>
                    </div>

                    {milestonesTotal === 0 ? (
                      <div className="text-center py-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-[11px] text-gray-400">Aucun jalon défini.</p>
                        <button
                          id={`btn-proj-breakdown-prompt-${project.id}`}
                          onClick={() => triggerBreakdownAI(project)}
                          className="mt-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center justify-center gap-1 mx-auto"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" /> Découper par l'IA
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {milestones.map(m => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 p-2 hover:bg-gray-50 rounded-lg text-xs"
                          >
                            <button
                              type="button"
                              id={`btn-toggle-milestone-${project.id}-${m.id}`}
                              onClick={() => handleToggleMilestone(project, m.id)}
                              className="text-gray-400 hover:text-indigo-600 transition shrink-0"
                            >
                              {m.completed ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            <span className={`flex-1 text-gray-700 truncate ${m.completed ? 'line-through text-gray-400' : ''}`}>
                              {m.title}
                            </span>
                            {m.date && (
                              <span className="text-[10px] text-gray-400 font-mono font-medium shrink-0">
                                {m.date}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom section (dates, progress & AI helpers) */}
                <div className="border-t border-gray-100 pt-4 space-y-3.5">
                  <div className="flex items-center justify-between text-xs">
                    {project.targetDate ? (
                      <span className="text-gray-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Échéance : {project.targetDate}
                      </span>
                    ) : (
                      <span className="text-gray-400 font-mono">Échéance non définie</span>
                    )}

                    {milestonesTotal > 0 && (
                      <span className="font-semibold text-indigo-600 font-mono">
                        {projectProgress}%
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {milestonesTotal > 0 && (
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${projectProgress}%` }}
                      />
                    </div>
                  )}

                  {/* Action buttons */}
                  {milestonesTotal > 0 && (
                    <div className="flex justify-between items-center pt-1.5">
                      <button
                        id={`btn-re-breakdown-ai-${project.id}`}
                        disabled={isBreakingDown && activeBreakdownProjectId === project.id}
                        onClick={() => triggerBreakdownAI(project)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Enrichir avec l'IA
                      </button>

                      {project.status === ProjectStatus.PLANNING && (
                        <button
                          id={`btn-activate-proj-${project.id}`}
                          onClick={() => onUpdateProject(project.id, { status: ProjectStatus.ACTIVE })}
                          className="text-[10px] font-bold text-gray-500 hover:text-gray-800 border border-gray-200 px-2 py-1 rounded-md"
                        >
                          Démarrer le projet
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Breakdown Result Modal Overlay */}
      {aiBreakdownResult && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="ai-breakdown-modal">
          <div className="bg-white rounded-2xl border border-gray-100 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-gray-900 font-sans tracking-tight">
                Plan de projet recommandé par l'IA
              </h3>
            </div>

            <p className="text-xs text-gray-500">
              Notre algorithme d'intelligence artificielle a analysé votre projet et vous propose d'ajouter les jalons stratégiques et les tâches de démarrage suivantes :
            </p>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {/* Milestones list */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-indigo-700 uppercase font-mono">
                  🟢 Jalons stratégiques proposés
                </h4>
                <div className="space-y-1 bg-indigo-50/30 p-3 rounded-xl border border-indigo-50/50">
                  {aiBreakdownResult.suggestedMilestones.map((sm, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-gray-700 py-1">
                      <span>• {sm.title}</span>
                      <span className="font-mono text-[10px] text-indigo-600 bg-white px-2 py-0.5 rounded shadow-sm">
                        + {sm.targetOffsetDays}j
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks list */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-emerald-700 uppercase font-mono">
                  ⚡ Tâches de démarrage immédiatement planifiées
                </h4>
                <div className="space-y-1.5 bg-emerald-50/30 p-3 rounded-xl border border-emerald-50/50">
                  {aiBreakdownResult.suggestedTasks.map((st, idx) => (
                    <div key={idx} className="text-xs text-gray-700">
                      <p className="font-semibold text-gray-800">• {st.title}</p>
                      <p className="text-[11px] text-gray-400 pl-3">{st.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-ai-breakdown"
                onClick={() => {
                  setAiBreakdownResult(null);
                  setActiveBreakdownProjectId(null);
                }}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
              >
                Ignorer
              </button>
              <button
                type="button"
                id="btn-apply-ai-breakdown"
                onClick={applyBreakdownAI}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                Appliquer le Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Prioritization Modal Overlay */}
      {showPrioritizerModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="ai-prioritizer-modal">
          <div className="bg-white rounded-2xl border border-gray-100 max-w-2xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="text-lg font-bold text-gray-900 font-sans tracking-tight">
                  Priorisation Stratégique IA des Projets
                </h3>
              </div>
              <button
                id="btn-close-prioritizer-modal"
                onClick={() => {
                  setShowPrioritizerModal(false);
                  setAiPrioritizationResult(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              L'intelligence artificielle analyse la charge de travail de vos projets, évalue leur impact stratégique et recommande de nouvelles priorités de façon impartiale.
            </p>

            {/* Optional Context Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 font-mono uppercase">Objectif prioritaire du moment (Optionnel)</label>
              <div className="flex gap-2">
                <input
                  id="prioritizer-context-input"
                  type="text"
                  placeholder="Ex: Me concentrer sur mes études, maximiser mes ventes professionnelles..."
                  value={prioritizationContext}
                  onChange={e => setPrioritizationContext(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none"
                />
                <button
                  id="btn-re-prioritize-context"
                  onClick={triggerPrioritizerAI}
                  disabled={isPrioritizing}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
                >
                  Analyser
                </button>
              </div>
            </div>

            {/* Prioritization Results */}
            {isPrioritizing ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500">Analyse de l'impact, de l'urgence et de l'effort par Gemini...</p>
              </div>
            ) : aiPrioritizationResult ? (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {aiPrioritizationResult.map((item, idx) => {
                  const origProj = projects.find(p => p.id === item.id);
                  if (!origProj) return null;

                  const priorityMapColors: any = {
                    low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                    medium: 'bg-amber-50 text-amber-700 border-amber-100',
                    high: 'bg-orange-50 text-orange-700 border-orange-100',
                    urgent: 'bg-rose-50 text-rose-700 border-rose-100',
                  };

                  return (
                    <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-gray-800">{origProj.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-gray-400">
                            Impact Score: {item.priorityScore}/10
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityMapColors[item.recommendedPriority]}`}>
                            Recommandé: {item.recommendedPriority.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed italic bg-white p-2.5 rounded-lg border border-gray-100">
                        "{item.rationale}"
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">Cliquez sur Analyser pour lancer la priorisation stratégique.</p>
              </div>
            )}

            {aiPrioritizationResult && (
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  id="btn-ignore-priorities"
                  onClick={() => {
                    setAiPrioritizationResult(null);
                    setShowPrioritizerModal(false);
                  }}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
                >
                  Ignorer
                </button>
                <button
                  type="button"
                  id="btn-apply-priorities"
                  onClick={applyPrioritiesAI}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Appliquer les Priorités IA
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
