import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, CheckCircle2, Clock, Star, Bell } from 'lucide-react';
import { Task, Project } from '../types';

interface CalendarProps {
  tasks: Task[];
  projects: Project[];
  onAddTask: (date: string) => void;
  onSelectTask: (task: Task) => void;
}

export default function Calendar({ tasks, projects, onAddTask, onSelectTask }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const FrenchMonths = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const FrenchWeekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Calculate days of the month
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Align to Monday
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const prevMonthDays = Array.from({ length: firstDayIndex }, (_, i) => {
    return {
      day: prevMonthTotalDays - firstDayIndex + i + 1,
      isCurrentMonth: false,
      dateStr: new Date(year, month - 1, prevMonthTotalDays - firstDayIndex + i + 1).toISOString().split('T')[0]
    };
  });

  const currentMonthDays = Array.from({ length: totalDays }, (_, i) => {
    const d = i + 1;
    // Format YYYY-MM-DD safely
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    return {
      day: d,
      isCurrentMonth: true,
      dateStr: `${year}-${monthStr}-${dayStr}`
    };
  });

  // Next month filling
  const remainingCells = 42 - (prevMonthDays.length + currentMonthDays.length);
  const nextMonthDays = Array.from({ length: remainingCells }, (_, i) => {
    const d = i + 1;
    const monthStr = String((month + 2) % 12 || 12).padStart(2, '0');
    const nextYear = month === 11 ? year + 1 : year;
    const dayStr = String(d).padStart(2, '0');
    return {
      day: d,
      isCurrentMonth: false,
      dateStr: `${nextYear}-${monthStr}-${dayStr}`
    };
  });

  const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Helper to retrieve tasks on a date
  const getTasksOnDate = (dateStr: string) => {
    return tasks.filter(task => task.date === dateStr);
  };

  // Helper to retrieve project milestones on a date
  const getMilestonesOnDate = (dateStr: string) => {
    const list: { projectTitle: string; milestoneTitle: string; completed: boolean }[] = [];
    projects.forEach(project => {
      if (project.milestones) {
        project.milestones.forEach(m => {
          if (m.date === dateStr) {
            list.push({
              projectTitle: project.title,
              milestoneTitle: m.title,
              completed: m.completed
            });
          }
        });
      }
    });
    return list;
  };

  const selectedTasks = getTasksOnDate(selectedDateStr);
  const selectedMilestones = getMilestonesOnDate(selectedDateStr);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="calendar-view-container">
      {/* Calendar Grid (Left/Center) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col h-full" id="calendar-left-grid">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900 font-sans tracking-tight">
              {FrenchMonths[month]} {year}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              id="btn-calendar-prev"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-50 border border-gray-100 text-gray-600 transition"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="btn-calendar-today"
              onClick={handleToday}
              className="px-3 py-1 text-xs font-medium border border-gray-100 rounded-lg hover:bg-gray-50 transition text-gray-700"
            >
              Aujourd'hui
            </button>
            <button
              id="btn-calendar-next"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-50 border border-gray-100 text-gray-600 transition"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {FrenchWeekdays.map((day, idx) => (
            <div key={idx} className="text-xs font-medium text-gray-400 py-1 font-mono">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {allDays.map((cell, idx) => {
            const dayTasks = getTasksOnDate(cell.dateStr);
            const dayMilestones = getMilestonesOnDate(cell.dateStr);
            const hasEvents = dayTasks.length > 0 || dayMilestones.length > 0;
            const isSelected = cell.dateStr === selectedDateStr;
            const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

            return (
              <button
                key={idx}
                id={`calendar-cell-${cell.dateStr}`}
                onClick={() => setSelectedDateStr(cell.dateStr)}
                className={`min-h-[72px] p-2 flex flex-col justify-between rounded-xl transition-all border text-left focus:outline-none focus:ring-2 focus:ring-indigo-100 ${
                  cell.isCurrentMonth
                    ? 'bg-white hover:border-indigo-100'
                    : 'bg-gray-50/50 text-gray-300 border-transparent'
                } ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm ring-1 ring-indigo-600'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className={`text-xs font-semibold ${
                    isToday
                      ? 'bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center font-sans shadow-sm'
                      : cell.isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {cell.day}
                  </span>
                  {isToday && !isToday && cell.isCurrentMonth && (
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                  )}
                </div>

                {/* Event Indicators */}
                <div className="flex flex-wrap gap-1 mt-1.5 overflow-hidden max-h-[28px]">
                  {dayTasks.slice(0, 3).map((task) => {
                    const priorityColors = {
                      low: 'bg-emerald-400',
                      medium: 'bg-amber-400',
                      high: 'bg-orange-500',
                      urgent: 'bg-rose-500',
                    };
                    return (
                      <span
                        key={task.id}
                        className={`w-2 h-2 rounded-full ${priorityColors[task.priority]} ${
                          task.status === 'completed' ? 'opacity-30' : ''
                        }`}
                        title={task.title}
                      />
                    );
                  })}
                  {dayMilestones.slice(0, 2).map((ms, msIdx) => (
                    <span
                      key={msIdx}
                      className="w-2 h-2 bg-indigo-500 rounded-sm"
                      title={`Jalon: ${ms.milestoneTitle}`}
                    />
                  ))}
                  {hasEvents && (dayTasks.length + dayMilestones.length > 5) && (
                    <span className="text-[9px] text-gray-400 font-bold font-mono">
                      +{dayTasks.length + dayMilestones.length - 5}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda (Right) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between" id="calendar-right-agenda">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 font-mono uppercase tracking-wider">
                Agenda du Jour
              </h3>
              <p className="text-base font-bold text-gray-900 font-sans tracking-tight">
                {new Date(selectedDateStr).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <button
              id="btn-calendar-add-task"
              onClick={() => onAddTask(selectedDateStr)}
              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition"
              title="Ajouter une tâche pour ce jour"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Agenda content list */}
          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {selectedTasks.length === 0 && selectedMilestones.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune tâche ni jalon planifié pour aujourd'hui.</p>
                <button
                  onClick={() => onAddTask(selectedDateStr)}
                  className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
                >
                  Planifier une tâche
                </button>
              </div>
            ) : (
              <>
                {/* Milestones first */}
                {selectedMilestones.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 font-mono flex items-center gap-1">
                      <Star className="w-3 h-3 text-indigo-500 fill-indigo-500" /> JALONS DE PROJET
                    </h4>
                    {selectedMilestones.map((ms, idx) => (
                      <div key={idx} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-50/80 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-indigo-700 font-mono uppercase tracking-wider font-semibold">
                            {ms.projectTitle}
                          </p>
                          <p className="text-sm font-medium text-gray-800">
                            {ms.milestoneTitle}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ms.completed ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {ms.completed ? 'Terminé' : 'En cours'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tasks */}
                {selectedTasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" /> TÂCHES PLANIFIÉES
                    </h4>
                    <div className="space-y-2">
                      {selectedTasks.map((task) => {
                        const priorityLabelColors = {
                          low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                          medium: 'bg-amber-50 text-amber-700 border-amber-100',
                          high: 'bg-orange-50 text-orange-700 border-orange-100',
                          urgent: 'bg-rose-50 text-rose-700 border-rose-100',
                        };

                        return (
                          <div
                            key={task.id}
                            id={`agenda-task-item-${task.id}`}
                            onClick={() => onSelectTask(task)}
                            className="p-3 border border-gray-100 hover:border-indigo-100 rounded-xl hover:bg-gray-50/40 cursor-pointer transition flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className={`text-sm font-medium text-gray-800 truncate ${
                                task.status === 'completed' ? 'line-through text-gray-400' : ''
                              }`}>
                                {task.title}
                              </p>
                              {task.time && (
                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" /> {task.time}
                                </p>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priorityLabelColors[task.priority]}`}>
                              {task.priority === 'low' ? 'Basse' : task.priority === 'medium' ? 'Moyenne' : task.priority === 'high' ? 'Haute' : 'Urgente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Security / sync statement at the bottom */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400 font-mono">
          <Bell className="w-3.5 h-3.5 text-gray-400" />
          <span>Synchronisation et rappels actifs</span>
        </div>
      </div>
    </div>
  );
}
