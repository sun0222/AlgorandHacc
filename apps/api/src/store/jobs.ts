export interface AgentRules {
  max_unit_price_eur: number;
  quantity: number;
  delivery_by: string;
  corridor: string;
  product: string;
}

export interface SpendRecord {
  id: string;
  timestamp: string;
  endpoint: string;
  amount_usd: number;
  tx_id?: string;
  demo?: boolean;
}

export interface JobStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  tx_id?: string;
  amount_usd?: number;
}

export interface JobResult {
  supplier_id: string;
  supplier_name: string;
  unit_price_eur: number;
  quantity: number;
  freight_eur: number;
  total_eur: number;
  order_id: string;
  explanation: string;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  rules: AgentRules;
  steps: JobStep[];
  spends: SpendRecord[];
  result?: JobResult;
  error?: string;
  created_at: string;
  updated_at: string;
}

const jobs = new Map<string, Job>();

export function createJob(rules: AgentRules): Job {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job: Job = {
    id,
    status: "queued",
    rules,
    steps: [
      { id: "prices", label: "Fetch packaging prices", status: "pending" },
      { id: "freight", label: "Get freight quotes", status: "pending" },
      { id: "compare", label: "Compare landed cost", status: "pending" },
      { id: "checkout", label: "Settle with supplier", status: "pending" },
    ],
    spends: [],
    created_at: now,
    updated_at: now,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, patch, { updated_at: new Date().toISOString() });
  return job;
}

export function listJobs(): Job[] {
  return [...jobs.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function updateStep(jobId: string, stepId: string, patch: Partial<JobStep>): void {
  const job = jobs.get(jobId);
  if (!job) return;
  const step = job.steps.find((s) => s.id === stepId);
  if (step) Object.assign(step, patch);
  job.updated_at = new Date().toISOString();
}

export function addSpend(jobId: string, spend: SpendRecord): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.spends.push(spend);
  job.updated_at = new Date().toISOString();
}
