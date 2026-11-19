// Single source of truth: the server validates with it and the browser builds forms/tables from it.
const o = (...v) => v.map((x) => ({ value: x, label: x.replace(/_/g, " ") }));
const T = (name, label, x = {}) => ({ name, label, type: "text", ...x });
const A = (name, label) => ({ name, label, type: "textarea" });
const N = (name, label, x = {}) => ({ name, label, type: "number", ...x });
const D = (name, label, x = {}) => ({ name, label, type: "date", ...x });
const S = (name, label, opts, x = {}) => ({ name, label, type: "select", options: o(...opts), ...x });
const F = (name, label, ref, refLabel, x = {}) => ({ name, label, type: "fk", ref, refLabel, ...x });
const P = F("project", "Project", "projects", "title", { list: true, filter: true });
const PR = { ...P, required: true };

module.exports = {
  projects: { title: "My Research Projects", fields: [
    T("title", "Title", { list: true, required: true }), A("abstract", "Abstract"), T("domain", "Research domain", { list: true }), T("keywords", "Keywords"),
    A("problem_statement", "Problem statement"), A("objectives", "Research objectives (one per line)"), A("scope", "Scope"), A("hypotheses_text", "Hypotheses"),
    A("methodology_summary", "Proposed methodology"), A("expected_outcomes", "Expected outcomes"), A("expected_contributions", "Expected contributions"),
    T("supervisor", "Supervisor"), S("status", "Status", ["planning", "active", "on_hold", "completed", "archived"], { list: true, filter: true }),
    D("start_date", "Start date"), D("target_date", "Target completion", { list: true }) ] },
  papers: { title: "Research Papers", upload: true, fields: [
    T("title", "Title", { list: true, required: true }), T("doi", "DOI", { list: true }), T("authors", "Authors (separate with ;)", { list: true }),
    N("year", "Year", { list: true, filter: true }), T("venue", "Journal / conference", { list: true }),
    S("pub_type", "Type", ["journal", "conference", "preprint", "book", "thesis", "other"], { filter: true }), T("publisher", "Publisher"), T("url", "Paper URL"),
    A("abstract", "Abstract"), T("keywords", "Keywords"), T("domain", "Research domain", { filter: true }), T("category", "Research category", { filter: true }),
    S("reading_status", "Reading status", ["to_read", "reading", "read", "reviewed", "important", "not_relevant"], { list: true, filter: true }),
    N("rating", "Rating (1-5)"), N("relevance", "Relevance (1-10)", { list: true }), P, A("notes", "Personal notes") ] },
  reviews: { title: "Literature Review", fields: [
    F("paper", "Paper", "papers", "title", { list: true, required: true, filter: true }), P,
    A("research_problem", "1. Research problem"), A("motivation", "2. Motivation"), A("existing_methods", "3. Existing methods"), A("proposed_methodology", "4. Proposed methodology"),
    A("models_algorithms", "5. Models & algorithms"), A("dataset_used", "6. Dataset used"), A("experimental_setup", "7. Experimental setup"), A("evaluation_metrics", "8. Evaluation metrics"),
    A("main_results", "9. Main results"), A("limitations", "10. Limitations"), A("future_work", "11. Future work"), A("research_opportunities", "12. Research opportunities"),
    A("my_observations", "13. MY observations (my own analysis, not from the paper)") ], extra: ["research_problem", "main_results", "limitations"] },
  gaps: { title: "Research Gaps", fields: [
    PR, T("title", "Gap title", { list: true, required: true }), A("description", "Description"), A("evidence", "Evidence from existing research"),
    T("supporting_papers", "Supporting papers (titles / DOIs)"), A("existing_problem", "Problem with existing approaches"), A("proposed_solution", "Proposed solution"),
    A("expected_contribution", "Expected contribution"), A("novelty", "Novelty assessment"), A("feasibility", "Feasibility"),
    S("priority", "Priority", ["low", "medium", "high"], { list: true, filter: true }),
    S("status", "Status", ["identified", "under_investigation", "literature_validated", "experimentally_validated", "rejected", "finalized"], { list: true, filter: true }) ] },
  questions: { title: "Research Questions", fields: [
    PR, A("text", "Question"), S("kind", "Kind", ["main", "supporting"], { list: true, filter: true }), F("gap", "Linked gap", "gaps", "title", { list: true }),
    A("objective", "Linked objective"), A("methodology_link", "Linked methodology"), A("validation_method", "Validation method"), S("status", "Status", ["draft", "finalized"], { list: true, filter: true }) ], extra: ["text"] },
  hypotheses: { title: "Hypotheses", fields: [
    PR, F("question", "Question", "questions", "text"), A("statement", "Hypothesis"), A("independent_variables", "Independent variables"),
    A("dependent_variables", "Dependent variables"), A("expected_results", "Expected results"), A("validation_methods", "Validation methods") ], extra: ["statement"] },
  methodologies: { title: "Methodologies", fields: [ PR, T("name", "Name", { list: true, required: true }), T("version", "Version", { list: true }),
    A("description", "Description"), A("coordination", "Agent coordination"), A("math_formulation", "Mathematical formulation") ] },
  agents: { title: "Agents", fields: [ F("methodology", "Methodology", "methodologies", "name", { list: true, required: true, filter: true }),
    T("name", "Agent name", { list: true, required: true }), N("order", "Order", { list: true }), A("responsibility", "Responsibility"), A("inputs", "Input"),
    A("outputs", "Output"), A("models_used", "Models used"), A("algorithm", "Algorithm details") ] },
  datasets: { title: "Datasets", fields: [ T("name", "Name", { list: true, required: true }), P, T("source", "Source", { list: true }), T("download_url", "Download URL"),
    T("doi_reference", "DOI / reference"), T("category", "Research category"), N("num_images", "# images"), N("num_products", "# products"), N("num_attributes", "# attributes"),
    T("data_format", "Format"), T("license", "License"), D("collection_date", "Collection date"), A("preprocessing", "Preprocessing"), T("split_info", "Train/val/test split"),
    S("status", "Status", ["identified", "downloading", "downloaded", "preprocessed", "ready"], { list: true, filter: true }), N("readiness", "Readiness %", { list: true }) ] },
  experiments: { title: "Experiments", fields: [ PR, T("code", "Experiment ID (EXP-001)", { list: true, required: true }), T("name", "Name", { list: true, required: true }),
    A("hypothesis", "Research hypothesis"), F("dataset", "Dataset", "datasets", "name", { list: true, filter: true }),
    S("variant", "Model variant", ["clip_baseline", "clip_metadata", "image_user_pref", "adaptive", "multi_agent", "other"], { list: true, filter: true }),
    T("model", "Model"), T("algorithm", "Algorithm"), A("parameters", "Parameters"), A("training_config", "Training configuration"), A("observations", "Observations"),
    A("limitations", "Limitations"), D("executed_on", "Execution date"), { name: "is_ablation", label: "Ablation study?", type: "checkbox" }, T("ablation_component", "Ablated component"),
    S("status", "Status", ["planned", "running", "completed", "failed"], { list: true, filter: true }) ] },
  results: { title: "Experiment Results (metrics)", fields: [ F("experiment", "Experiment", "experiments", "code", { list: true, required: true, filter: true }),
    S("metric", "Metric", ["precision_at_k", "recall_at_k", "ndcg_at_k", "map", "hit_rate", "accuracy", "explanation_faithfulness", "latency_ms", "computational_cost"], { list: true, filter: true, required: true }),
    N("k", "K", { list: true }), N("value", "Value", { list: true, required: true, step: "any" }), T("note", "Note") ] },
  tasks: { title: "Tasks & Timeline", fields: [ PR, T("title", "Title", { list: true, required: true }), A("description", "Description"),
    S("priority", "Priority", ["low", "medium", "high"], { list: true, filter: true }), S("status", "Status", ["not_started", "in_progress", "under_review", "completed", "on_hold"], { list: true, filter: true }),
    D("start_date", "Start date"), D("due_date", "Deadline", { list: true }), N("progress", "Progress %", { list: true }), { name: "reminder", label: "Reminder", type: "datetime-local" },
    A("subtasks", "Subtasks (one per line)"), A("notes", "Notes") ] },
  manuscripts: { title: "Paper Writing", doc: true, help: "Creating a manuscript auto-creates its 14 sections. Edit them under Related records → Manuscript Sections. Never paste invented references.",
    fields: [ PR, T("title", "Manuscript title", { list: true, required: true }), N("version", "Version", { list: true }) ] },
  sections: { title: "Manuscript Sections", noCreate: true, fields: [ F("manuscript", "Manuscript", "manuscripts", "title", { list: true, filter: true }), T("name", "Section", { list: true, readonlyEdit: true }),
    A("content", "Current draft"), N("completion", "Completion %", { list: true }), A("notes", "Notes"), S("review_status", "Review status", ["draft", "needs_review", "reviewed", "final"], { list: true, filter: true }) ] },
  venues: { title: "Journals & Conferences", help: "Nothing is assumed to be indexed or legitimate. Tick 'verified' only after checking yourself.", fields: [
    T("name", "Venue name", { list: true, required: true }), T("publisher", "Publisher"), T("website", "Website"), S("pub_type", "Type", ["journal", "conference"], { list: true, filter: true }),
    A("scope", "Research scope"), D("deadline", "Submission deadline", { list: true }), T("fee", "Publication fee"), T("indexing", "Indexing (verify yourself)"),
    T("guidelines_url", "Author guidelines URL"), T("template_url", "Template URL"), T("submission_url", "Submission URL"),
    { name: "verified", label: "I verified this venue", type: "checkbox", list: true } ] },
  submissions: { title: "Submissions", fields: [ PR, F("venue", "Venue", "venues", "name", { list: true, required: true }),
    S("stage", "Stage", ["target_identified", "under_preparation", "ready_for_submission", "submitted", "under_review", "revision_required", "accepted", "rejected", "published"], { list: true, filter: true }),
    D("submission_date", "Submission date", { list: true }), T("manuscript_version", "Manuscript version"), T("submission_id", "Submission ID"), D("revision_deadline", "Revision deadline"),
    A("reviewer_comments", "Reviewer comments"), A("response_to_reviewers", "Response to reviewers"), T("final_link", "Final publication link"), T("doi", "DOI") ] },
  meetings: { title: "Supervisor Meetings", fields: [ PR, T("supervisor", "Supervisor", { list: true }), { name: "date", label: "Meeting date", type: "datetime-local", list: true },
    A("agenda", "Agenda"), A("discussion_notes", "Discussion notes"), A("decisions", "Decisions"), A("assigned_tasks", "Assigned tasks"), A("feedback", "Feedback"),
    { name: "next_meeting", label: "Next meeting", type: "datetime-local", list: true } ] },
  notes: { title: "Research Notes", fields: [ T("title", "Title", { list: true, required: true }),
    S("kind", "Kind", ["general", "paper", "methodology", "algorithm", "idea", "equation", "observation", "code", "future"], { list: true, filter: true }),
    A("body", "Body"), T("tags", "Tags (comma separated)", { list: true }), P, F("paper", "Linked paper", "papers", "title"), F("experiment", "Linked experiment", "experiments", "name"), F("gap", "Linked gap", "gaps", "title") ] },
};
module.exports.sections.fields.forEach((f) => f);
