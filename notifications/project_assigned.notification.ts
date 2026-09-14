import { defineNotification, _ } from "@ddcore/sdk";
import type { Project } from "../.ddcore/types";

export default defineNotification<Project>({
  name: "demo.project_assigned",
  doctype: "Project",
  event: "on_insert",
  condition: (doc) => Boolean(doc.assignee),
  recipients: (doc) => (doc.assignee ? [doc.assignee] : []),
  desk: {
    title: (doc) => _("Project assigned: {0}", [doc.title]),
    message: (doc) => _("You have been designated as lead for project {0}.", [doc.code]),
  },
});
