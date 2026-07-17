export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
}

export enum ReminderChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  IN_APP = 'in_app',
}

export interface Milestone {
  id: string;
  title: string;
  targetOffsetDays?: number;
  date?: string; // YYYY-MM-DD
  completed: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  priority: Priority;
  status: TaskStatus;
  projectId?: string; // Linked project ID
  createdAt: any;
  updatedAt: any;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: Priority;
  status: ProjectStatus;
  startDate?: string; // YYYY-MM-DD
  targetDate?: string; // YYYY-MM-DD
  milestones?: Milestone[];
  createdAt: any;
  updatedAt: any;
}

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  datetime: string; // YYYY-MM-DDTHH:mm
  type: 'task' | 'project' | 'custom';
  targetId?: string;
  channel: ReminderChannel;
  sent: boolean;
  createdAt: any;
  updatedAt: any;
}
