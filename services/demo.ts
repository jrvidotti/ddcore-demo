// Demonstration data, discovered by `ddcore demo`. Idempotent: it checks each
// code before inserting, and any state past the initial one comes from the
// controller's methods — never from writing a derived field directly.
//
// This is data, not interface: it is English and it is not in the catalogue.
import type { Project, Task, ToDo, User } from "../.ddcore/types";

const u = () => ddcore.utils;

export interface DemoResult {
  created: string[];
  count: number;
}

export function generate(): DemoResult {
  const created: string[] = [];
  const today = u().today();

  // 1. Users (+3)
  const users: { email: string; full_name: string; role: string; default_project?: string }[] = [
    { email: "ana@example.com", full_name: "Ana Silva", role: "Project Manager", default_project: "PORTAL" },
    { email: "carlos@example.com", full_name: "Carlos Mendes", role: "Project Contributor", default_project: "PORTAL" },
    { email: "beatriz@example.com", full_name: "Beatriz Lima", role: "Project Contributor", default_project: "INFRA" },
  ];

  for (const usr of users) {
    if (ddcore.db.exists("User", usr.email)) continue;
    const user = ddcore.newDoc<User>("User", {
      email: usr.email,
      full_name: usr.full_name,
      user_type: "System User",
      enabled: true,
    });
    user.append("roles", { role: usr.role });
    user.insert();
    created.push(user.name);
  }

  // 2. Projects
  const projects: {
    code: string;
    title: string;
    description: string;
    assignee: string;
    startDays: number;
    endDays: number;
    milestones: { title: string; days: number; completed?: boolean; completedDays?: number }[];
  }[] = [
    {
      code: "DEMO",
      title: "Demonstration project",
      description: "Created by `ddcore demo` to exercise the example app.",
      assignee: "Administrator",
      startDays: -30,
      endDays: 60,
      milestones: [
        { title: "Discovery", days: -15, completed: true, completedDays: -14 },
        { title: "Implementation", days: 20 },
        { title: "Delivery", days: 55 },
      ],
    },
    {
      code: "PORTAL",
      title: "Customer Portal Redesign",
      description: "Modern responsive portal for customer self-service, billing, and support.",
      assignee: "ana@example.com",
      startDays: -45,
      endDays: 45,
      milestones: [
        { title: "UX Wireframes & Prototypes", days: -20, completed: true, completedDays: -21 },
        { title: "Frontend Implementation", days: 15 },
        { title: "Security & Integration QA", days: 40 },
      ],
    },
    {
      code: "INFRA",
      title: "Cloud Infrastructure Migration",
      description: "Container orchestration, automated backup pipelines, and disaster recovery.",
      assignee: "Administrator",
      startDays: -10,
      endDays: 90,
      milestones: [
        { title: "Architecture Assessment", days: -2, completed: true, completedDays: -2 },
        { title: "Container Platform Setup", days: 30 },
        { title: "Database Failover Verification", days: 75 },
      ],
    },
  ];

  for (const p of projects) {
    if (ddcore.db.exists("Project", p.code)) continue;
    const project = ddcore.newDoc<Project>("Project", {
      code: p.code,
      title: p.title,
      description: p.description,
      assignee: p.assignee,
      start_date: u().addDays(today, p.startDays),
      end_date: u().addDays(today, p.endDays),
    });
    for (const m of p.milestones) {
      project.append("milestones", {
        title: m.title,
        due_date: u().addDays(today, m.days),
        completed: Boolean(m.completed),
        completed_on: m.completed && m.completedDays !== undefined ? u().addDays(today, m.completedDays) : null,
      });
    }
    project.insert();
    created.push(project.name);
  }

  // Set default_project on users now that projects exist
  for (const usr of users) {
    if (usr.default_project && ddcore.db.exists("Project", usr.default_project)) {
      if (!ddcore.db.getValue("User", usr.email, "default_project")) {
        ddcore.db.setValue("User", usr.email, "default_project", usr.default_project);
      }
    }
  }

  // 3. Tasks
  const tasks: {
    code: string;
    project: string;
    title: string;
    assignee: string;
    priority: Task["priority"];
    days: number;
    action?: "start" | "complete";
  }[] = [
    // DEMO
    { code: "DEMO-01", project: "DEMO", title: "Write the scope", assignee: "Administrator", priority: "High", days: 7 },
    { code: "DEMO-02", project: "DEMO", title: "Build the record form", assignee: "Administrator", priority: "Medium", days: 21, action: "start" },
    { code: "DEMO-03", project: "DEMO", title: "Gather requirements", assignee: "Administrator", priority: "Low", days: -10, action: "complete" },
    { code: "DEMO-04", project: "DEMO", title: "Review milestone deliverable", assignee: "ana@example.com", priority: "Medium", days: 14 },

    // PORTAL
    { code: "PORT-01", project: "PORTAL", title: "Design high-fidelity UI components", assignee: "carlos@example.com", priority: "High", days: 10, action: "start" },
    { code: "PORT-02", project: "PORTAL", title: "Implement customer authentication flow", assignee: "beatriz@example.com", priority: "High", days: -5, action: "complete" },
    { code: "PORT-03", project: "PORTAL", title: "Build responsive dashboard views", assignee: "carlos@example.com", priority: "Medium", days: 20 },
    { code: "PORT-04", project: "PORTAL", title: "Setup end-to-end user journey tests", assignee: "beatriz@example.com", priority: "Medium", days: 35 },

    // INFRA
    { code: "INF-01", project: "INFRA", title: "Provision production Kubernetes clusters", assignee: "carlos@example.com", priority: "High", days: 15, action: "start" },
    { code: "INF-02", project: "INFRA", title: "Configure automated backup pipelines", assignee: "beatriz@example.com", priority: "Medium", days: 28 },
    { code: "INF-03", project: "INFRA", title: "Audit network security and firewalls", assignee: "ana@example.com", priority: "High", days: 40 },
  ];

  for (const t of tasks) {
    if (ddcore.db.exists("Task", t.code)) continue;
    const task = ddcore.newDoc<Task>("Task", {
      code: t.code,
      project: t.project,
      title: t.title,
      assignee: t.assignee,
      priority: t.priority,
      due_date: u().addDays(today, t.days),
    }).insert();
    if (t.action) task.runMethod(t.action);
    created.push(task.name);
  }

  // 4. ToDos
  const todos: {
    description: string;
    allocated_to: string;
    assigned_by: string;
    priority: ToDo["priority"];
    status?: ToDo["status"];
    days: number;
    reference_type?: string;
    reference_name?: string;
  }[] = [
    {
      description: "Prepare bi-weekly stakeholder progress report",
      allocated_to: "ana@example.com",
      assigned_by: "Administrator",
      priority: "High",
      status: "Open",
      days: 0,
      reference_type: "Project",
      reference_name: "PORTAL",
    },
    {
      description: "Review design system tokens and responsive breakpoints",
      allocated_to: "carlos@example.com",
      assigned_by: "ana@example.com",
      priority: "Urgent",
      status: "Open",
      days: 2,
      reference_type: "Task",
      reference_name: "PORT-01",
    },
    {
      description: "Validate S3 lifecycle backup policies with DevOps lead",
      allocated_to: "beatriz@example.com",
      assigned_by: "Administrator",
      priority: "Medium",
      status: "Open",
      days: 5,
      reference_type: "Task",
      reference_name: "INF-02",
    },
    {
      description: "Review quarterly cloud infrastructure and licensing costs",
      allocated_to: "Administrator",
      assigned_by: "Administrator",
      priority: "Low",
      status: "Open",
      days: 10,
    },
    {
      description: "Update team onboarding guide in developer documentation",
      allocated_to: "carlos@example.com",
      assigned_by: "carlos@example.com",
      priority: "Low",
      status: "Closed",
      days: -3,
    },
  ];

  for (const td of todos) {
    const existing = ddcore.db.exists("ToDo", { description: td.description, allocated_to: td.allocated_to });
    if (existing) continue;

    const todo = ddcore.newDoc<ToDo>("ToDo", {
      description: td.description,
      allocated_to: td.allocated_to,
      assigned_by: td.assigned_by,
      priority: td.priority,
      status: td.status || "Open",
      date: u().addDays(today, td.days),
      reference_type: td.reference_type || null,
      reference_name: td.reference_name || null,
    }).insert();
    created.push(todo.name);
  }

  return { created, count: created.length };
}
