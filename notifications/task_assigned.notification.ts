import { defineNotification, _ } from "@ddcore/sdk";
import type { Task } from "../.ddcore/types";

export default defineNotification<Task>({
  name: "demo.task_assigned",
  doctype: "Task",
  event: "on_insert",
  condition: (doc) => Boolean(doc.assignee),
  recipients: (doc) => (doc.assignee ? [doc.assignee] : []),
  desk: {
    title: (doc) => _("Task assigned: {0}", [doc.title]),
    message: (doc) => _("You have been assigned to task {0} in project {1}.", [doc.code, doc.project]),
  },
});
