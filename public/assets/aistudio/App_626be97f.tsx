/**
 * Variance Analysis & CFO Commentary — single-file React app
 * ---------------------------------------------------------------------------
 * Built for Google AI Studio (Build mode, React + TypeScript template).
 * Paste this whole file over App.tsx. No extra packages required:
 *   - Charts are drawn in plain SVG.
 *   - Excel (.xlsx) upload/export loads SheetJS on demand from esm.sh.
 *   - CSV upload works without any library.
 * The sample P&L (99 lines, BU1–BU3) is embedded so the app works on first load.
 *
 * Sign convention: Variance = Actual − Budget. Profit impact = Variance for
 * revenue, −Variance for costs (positive = favourable to operating profit).
 */
import React, { useMemo, useState } from "react";

// ============================================================================ types
type Raw = { Segment: string; Category: string; Account: string; Actual: number; Budget: number; VarSrc?: number; PctSrc?: number };
type FU = "Favourable" | "Adverse" | "On budget";
type Row = Raw & {
  Variance: number; VariancePct: number; Type: string; IsRevenue: boolean; Impact: number; FU: FU;
  Material: boolean; RAG: "Red" | "Amber" | "Green";
  Nature: string; Owner: string; Standard: string; Drivers: string; Action: string; Commentary: string;
};
type Settings = { amt: number; pctThr: number; rule: "Either" | "Both"; floor: number; gmBench: number; cur: string; period: string };
type Check = { Segment: string; Test: string; Severity: "High" | "Medium" | "Info"; Finding: string; Action: string };
type KB = { keywords?: string[]; nature: string; fav_drivers: string; adv_drivers: string; fav_action: string; adv_action: string; owner: string; standard: string };

// ============================================================================ embedded data
const KB_DATA: { kb: KB[]; def: KB } = {
 "kb": [
  {
   "keywords": [
    "usage",
    "overage"
   ],
   "nature": "Volume-driven / variable",
   "fav_drivers": "higher consumption by existing customers above contracted entitlements",
   "adv_drivers": "lower customer consumption, or customers upgrading to plans with larger entitlements that absorb overage",
   "fav_action": "Do not annualise: usage revenue is inherently volatile. Confirm the matching hosting cost and assess whether persistent overage should be converted into committed subscription upgrades.",
   "adv_action": "Analyse consumption trends by top customers and confirm whether the shortfall reflects plan migration (revenue shifting to subscription) rather than lost demand.",
   "owner": "CRO / Revenue Operations",
   "standard": "IFRS 15 - variable consideration (usage-based royalties/fees recognised as usage occurs)"
  },
  {
   "keywords": [
    "saas subscription",
    "subscription revenue",
    "recurring revenue"
   ],
   "nature": "Recurring revenue",
   "fav_drivers": "new-logo bookings ahead of plan, expansion/upsell, price uplifts or lower churn",
   "adv_drivers": "slower new-logo conversion, downgrades or churn, or delayed go-lives deferring the subscription start date",
   "fav_action": "Validate quality of the beat through the ARR roll-forward (new / expansion / contraction / churn). Confirm no one-off true-ups, back-billing or multi-year prepayments are recognised in the period.",
   "adv_action": "Obtain the ARR bridge, pipeline coverage for the next two quarters and the renewal calendar; quantify churn by cohort and agree a recovery plan with the CRO.",
   "owner": "CRO / Revenue Operations",
   "standard": "IFRS 15 - recognised ratably over the subscription term"
  },
  {
   "keywords": [
    "implementation"
   ],
   "nature": "Project / non-recurring revenue",
   "fav_drivers": "faster project delivery, higher consultant utilisation or change requests billed",
   "adv_drivers": "project delays, milestone slippage, lower utilisation or fixed-fee overruns reducing measured progress",
   "fav_action": "Confirm percentage-of-completion inputs and that no future milestones were recognised early.",
   "adv_action": "Review the project backlog and WIP ageing; identify slipped milestones and their effect on subscription go-live dates (delayed implementation usually delays recurring revenue too).",
   "owner": "Head of Professional Services",
   "standard": "IFRS 15 - over-time recognition; measure of progress"
  },
  {
   "keywords": [
    "training"
   ],
   "nature": "Project / non-recurring revenue",
   "fav_drivers": "higher training attendance or bundled training delivered earlier than planned",
   "adv_drivers": "lower course uptake, cancelled sessions or training bundled free into deals",
   "fav_action": "Confirm delivery evidence for sessions recognised and that unearned training credits are deferred.",
   "adv_action": "Review course attendance and unused prepaid training credits; assess whether training is being discounted to close subscription deals.",
   "owner": "Head of Professional Services",
   "standard": "IFRS 15 - recognised on delivery"
  },
  {
   "keywords": [
    "managed services",
    "premium support"
   ],
   "nature": "Recurring revenue",
   "fav_drivers": "higher attach rate of premium support / managed services on new and renewing contracts",
   "adv_drivers": "lower attach rate, downgrades to standard support or competitive price pressure",
   "fav_action": "Confirm the support cost base is scaled to the higher service commitments (see Customer Support payroll).",
   "adv_action": "Analyse attach rate by segment and renewal; review pricing and service-level packaging.",
   "owner": "Head of Customer Success",
   "standard": "IFRS 15 - stand-ready obligation recognised over time"
  },
  {
   "keywords": [
    "channel partner",
    "partner revenue",
    "reseller"
   ],
   "nature": "Recurring / partner-sourced revenue",
   "fav_drivers": "stronger partner-sourced bookings or new partner activations",
   "adv_drivers": "weaker partner pipeline, partner attrition or higher partner discounts",
   "fav_action": "Confirm gross vs net (principal vs agent) presentation is consistent with budget, and that partner rebates / MDF accruals are complete.",
   "adv_action": "Review partner pipeline and partner-level performance; confirm rebate accruals and discount approvals.",
   "owner": "VP Channels / Alliances",
   "standard": "IFRS 15 B34-B38 - principal vs agent; consideration payable to a customer"
  },
  {
   "keywords": [
    "cloud hosting",
    "infrastructure",
    "aws",
    "gcp",
    "azure"
   ],
   "nature": "Volume-driven / variable",
   "fav_drivers": "reserved-instance / savings-plan coverage, workload optimisation or lower usage",
   "adv_drivers": "higher customer usage, unoptimised workloads, data egress, or double-running during migrations",
   "fav_action": "Confirm the saving is structural (commitments, rightsizing) rather than a delayed invoice; check accrual for unbilled cloud usage.",
   "adv_action": "Compare hosting growth with usage revenue growth; obtain a FinOps review (unit cost per customer/transaction, idle resources, commitment coverage).",
   "owner": "CTO / Head of Cloud Operations",
   "standard": ""
  },
  {
   "keywords": [
    "third-party api",
    "software licenses",
    "licences",
    "licenses"
   ],
   "nature": "Contractual / semi-fixed",
   "fav_drivers": "renegotiated contracts, vendor consolidation or deferred renewals",
   "adv_drivers": "price escalations at renewal, seat true-ups, volume tiers exceeded or FX on USD-denominated contracts",
   "fav_action": "Confirm whether the saving reflects timing of renewal invoices; review the contract renewal calendar.",
   "adv_action": "Review vendor contracts for escalation clauses and true-ups; quantify FX effect separately from volume and price.",
   "owner": "Procurement / CTO",
   "standard": ""
  },
  {
   "keywords": [
    "customer support payroll",
    "support payroll"
   ],
   "nature": "Structural (headcount)",
   "fav_drivers": "open vacancies or attrition not yet back-filled",
   "adv_drivers": "headcount ahead of plan, overtime, or wage increases above budget",
   "fav_action": "Assess service-level risk from vacancies (ticket backlog, response times, CSAT).",
   "adv_action": "Reconcile actual to budgeted FTE and average cost; confirm whether headcount growth is justified by premium-support revenue growth.",
   "owner": "Head of Customer Support / HR",
   "standard": ""
  },
  {
   "keywords": [
    "professional services delivery",
    "delivery cost"
   ],
   "nature": "Variable (project-driven)",
   "fav_drivers": "lower subcontractor use or higher internal utilisation",
   "adv_drivers": "fixed-fee project overruns, subcontractor premiums or low utilisation",
   "fav_action": "Read together with PS revenue: a cost saving that coincides with a revenue shortfall indicates lower activity rather than efficiency.",
   "adv_action": "Calculate PS gross margin and project-level overruns; review subcontractor rates and fixed-fee estimating.",
   "owner": "Head of Professional Services",
   "standard": ""
  },
  {
   "keywords": [
    "customer success allocation",
    "allocation"
   ],
   "nature": "Internal allocation",
   "fav_drivers": "lower cost pool or a change in the allocation key",
   "adv_drivers": "higher cost pool or a change in the allocation key",
   "fav_action": "Allocation variances net to nil at group level; confirm the allocation key is consistent with budget before attributing performance to the segment.",
   "adv_action": "Allocation variances net to nil at group level; confirm the allocation key is consistent with budget and identify the underlying cost-pool movement.",
   "owner": "Financial Controller (FP&A)",
   "standard": "IFRS 8 - consistency of segment measures"
  },
  {
   "keywords": [
    "data center",
    "telecom"
   ],
   "nature": "Contractual / semi-fixed",
   "fav_drivers": "site consolidation, contract renegotiation or migration to cloud",
   "adv_drivers": "capacity additions, power-cost escalation or double-running during migration",
   "fav_action": "Confirm the saving is not offset by higher cloud hosting cost (migration effect).",
   "adv_action": "Identify one-off migration or double-running costs separately from run-rate cost.",
   "owner": "CTO / Infrastructure",
   "standard": ""
  },
  {
   "keywords": [
    "contractor",
    "external dev",
    "agencies"
   ],
   "nature": "Discretionary / flexible capacity",
   "fav_drivers": "lower use of external development capacity",
   "adv_drivers": "contractors used to cover vacancies or accelerate delivery",
   "fav_action": "Confirm roadmap delivery has not slipped as a result.",
   "adv_action": "Assess substitution against engineering payroll vacancies; review contractor day rates, conversion-to-permanent plans and IP assignment clauses.",
   "owner": "CTO",
   "standard": ""
  },
  {
   "keywords": [
    "engineering payroll"
   ],
   "nature": "Structural (headcount)",
   "fav_drivers": "hiring lag / vacancies, or a higher proportion of development cost capitalised",
   "adv_drivers": "headcount ahead of plan, salary inflation, or lower development cost capitalisation",
   "fav_action": "Separate vacancy saving from capitalisation effect. A vacancy-driven saving is a delivery risk to the product roadmap, not an efficiency.",
   "adv_action": "Reconcile FTE and average cost to budget and confirm the capitalisation rate applied versus budget.",
   "owner": "CTO / HR",
   "standard": "IAS 38 - capitalisation of development costs"
  },
  {
   "keywords": [
    "product management payroll"
   ],
   "nature": "Structural (headcount)",
   "fav_drivers": "open product-management roles",
   "adv_drivers": "headcount added ahead of plan or salary inflation",
   "fav_action": "Assess impact of vacancies on roadmap prioritisation.",
   "adv_action": "Reconcile FTE and average cost to budget.",
   "owner": "CPO / HR",
   "standard": ""
  },
  {
   "keywords": [
    "qa",
    "testing"
   ],
   "nature": "Semi-fixed (tooling)",
   "fav_drivers": "deferred tooling purchases or lower test-environment usage",
   "adv_drivers": "additional test environments or tooling licences",
   "fav_action": "Confirm whether the saving is timing (deferred purchase) and its effect on release quality.",
   "adv_action": "Review tooling licences for overlap and environment utilisation.",
   "owner": "CTO",
   "standard": ""
  },
  {
   "keywords": [
    "r&d software",
    "software subscriptions"
   ],
   "nature": "Contractual / semi-fixed",
   "fav_drivers": "licence rationalisation or deferred renewals",
   "adv_drivers": "additional seats or price increases at renewal",
   "fav_action": "Confirm timing of renewal invoices.",
   "adv_action": "Run a licence utilisation review and remove unused seats.",
   "owner": "CTO / Procurement",
   "standard": ""
  },
  {
   "keywords": [
    "commission",
    "bonuses"
   ],
   "nature": "Variable (bookings-linked)",
   "fav_drivers": "lower bookings attainment, plan design changes or accrual timing",
   "adv_drivers": "bookings above quota (accelerators), SPIFFs or plan changes",
   "fav_action": "Commissions should move with bookings. If revenue is ahead of budget while commissions are below, verify completeness of the commission accrual and the amortisation of capitalised contract costs.",
   "adv_action": "Confirm the overspend is matched by bookings over-achievement; review accelerator payouts and SPIFF approvals.",
   "owner": "CRO / Sales Compensation",
   "standard": "IFRS 15.91-94 - incremental costs of obtaining a contract"
  },
  {
   "keywords": [
    "sales base salar"
   ],
   "nature": "Structural (headcount)",
   "fav_drivers": "open quota-carrying roles",
   "adv_drivers": "sales hiring ahead of plan or salary inflation",
   "fav_action": "Quantify capacity shortfall and its effect on next-period bookings.",
   "adv_action": "Confirm new reps have a defined ramp and productivity target; reconcile FTE to plan.",
   "owner": "CRO / HR",
   "standard": ""
  },
  {
   "keywords": [
    "digital advertising",
    "paid search",
    "social"
   ],
   "nature": "Discretionary",
   "fav_drivers": "campaign phasing or reduced paid acquisition",
   "adv_drivers": "campaigns brought forward, higher cost-per-click or new channel tests",
   "fav_action": "Determine whether the underspend is timing (spend expected later in the year) or a permanent saving; check pipeline impact.",
   "adv_action": "Review CAC, cost-per-MQL and pipeline attribution for the incremental spend.",
   "owner": "CMO",
   "standard": ""
  },
  {
   "keywords": [
    "field marketing",
    "events"
   ],
   "nature": "Discretionary / timing",
   "fav_drivers": "events postponed or cancelled",
   "adv_drivers": "additional or brought-forward events, or venue cost overruns",
   "fav_action": "Confirm whether events are rescheduled (timing) or cancelled (permanent).",
   "adv_action": "Obtain event-level ROI (pipeline sourced/influenced vs cost) and confirm approval of unbudgeted events.",
   "owner": "CMO",
   "standard": ""
  },
  {
   "keywords": [
    "brand",
    "pr campaign"
   ],
   "nature": "Discretionary",
   "fav_drivers": "campaign phasing or deferral",
   "adv_drivers": "unbudgeted brand campaigns or agency fee overruns",
   "fav_action": "Confirm phasing of remaining campaign spend.",
   "adv_action": "Confirm Board/ExCo approval of incremental brand spend and the measurement framework.",
   "owner": "CMO",
   "standard": ""
  },
  {
   "keywords": [
    "travel",
    "entertainment",
    "t&e"
   ],
   "nature": "Discretionary",
   "fav_drivers": "lower travel activity or tighter policy enforcement",
   "adv_drivers": "higher travel activity, policy exceptions or fare inflation",
   "fav_action": "Check for unsubmitted expense claims (accrual completeness).",
   "adv_action": "Review policy compliance and the top claimants; link travel to pipeline activity.",
   "owner": "CRO / Finance",
   "standard": ""
  },
  {
   "keywords": [
    "martech",
    "crm",
    "hubspot"
   ],
   "nature": "Contractual / semi-fixed",
   "fav_drivers": "licence rationalisation or deferred renewals",
   "adv_drivers": "added seats, tier upgrades or new tools",
   "fav_action": "Confirm timing of renewals.",
   "adv_action": "Run a MarTech stack utilisation and overlap review.",
   "owner": "CMO / Marketing Ops",
   "standard": ""
  },
  {
   "keywords": [
    "executive",
    "hq payroll"
   ],
   "nature": "Structural (headcount)",
   "fav_drivers": "vacant executive roles or lower bonus accrual",
   "adv_drivers": "new executive hires, severance, retention awards or higher bonus accrual",
   "fav_action": "Confirm the bonus accrual reflects expected full-year outcome.",
   "adv_action": "Separate one-off items (severance, sign-on, retention) from run-rate; confirm Remuneration Committee approvals.",
   "owner": "CEO / CHRO",
   "standard": "IAS 19 - short-term employee benefits (bonus accrual)"
  },
  {
   "keywords": [
    "legal",
    "regulatory",
    "compliance"
   ],
   "nature": "Matter-driven / timing",
   "fav_drivers": "lower matter activity or delayed external counsel invoices",
   "adv_drivers": "new litigation or regulatory matters, or higher external counsel fees",
   "fav_action": "Obtain confirmation of work-in-progress from external counsel; an underspend often reflects unbilled work and an incomplete accrual.",
   "adv_action": "Obtain a matter-by-matter schedule; assess whether any matter requires a provision or contingent liability disclosure.",
   "owner": "General Counsel",
   "standard": "IAS 37 - provisions and contingent liabilities"
  },
  {
   "keywords": [
    "accounting",
    "audit",
    "tax advisory"
   ],
   "nature": "Contractual / one-off",
   "fav_drivers": "timing of audit fee billing or lower advisory use",
   "adv_drivers": "audit fee overruns, additional scope or one-off tax advisory",
   "fav_action": "Confirm the audit fee accrual reflects the engagement letter.",
   "adv_action": "Identify one-off advisory projects separately from recurring audit fees.",
   "owner": "CFO",
   "standard": ""
  },
  {
   "keywords": [
    "recruiting",
    "hr systems"
   ],
   "nature": "Discretionary / activity-driven",
   "fav_drivers": "lower hiring volume or fewer agency placements",
   "adv_drivers": "higher agency usage, hiring volume above plan or new HR systems",
   "fav_action": "Read together with payroll: lower recruiting spend usually explains vacancy-driven payroll savings.",
   "adv_action": "Read together with payroll: if payroll is under budget while recruiting is over, the hiring funnel is not converting. Review agency vs direct sourcing mix and cost-per-hire.",
   "owner": "CHRO",
   "standard": ""
  },
  {
   "keywords": [
    "rent",
    "facilities",
    "office"
   ],
   "nature": "Fixed / contractual",
   "fav_drivers": "space consolidation or lower service charges",
   "adv_drivers": "service-charge escalation, new space or dilapidation costs",
   "fav_action": "Confirm no unbilled service charges are outstanding.",
   "adv_action": "Identify one-off fit-out or dilapidation costs; confirm IFRS 16 treatment of any new lease.",
   "owner": "COO / Facilities",
   "standard": "IFRS 16 - only short-term/low-value leases and service charges sit in operating cost"
  },
  {
   "keywords": [
    "insurance",
    "overhead"
   ],
   "nature": "Fixed / contractual",
   "fav_drivers": "lower premiums at renewal",
   "adv_drivers": "premium increases at renewal or additional cover",
   "fav_action": "Confirm prepayment amortisation is correct.",
   "adv_action": "Review the renewal outcome and cover levels with the broker.",
   "owner": "CFO / Risk",
   "standard": ""
  },
  {
   "keywords": [
    "bad debt",
    "doubtful",
    "expected credit"
   ],
   "nature": "Estimate / judgemental",
   "fav_drivers": "improved collections or release of specific provisions",
   "adv_drivers": "deterioration in receivables ageing, specific customer defaults or higher expected-credit-loss rates",
   "fav_action": "Challenge any provision release: confirm cash was actually collected or credit quality improved.",
   "adv_action": "Obtain the debtor ageing and ECL matrix; identify specific customers driving the charge and review credit-control and collection actions.",
   "owner": "Financial Controller / Credit Control",
   "standard": "IFRS 9 - expected credit loss model"
  }
 ],
 "def": {
  "nature": "General",
  "fav_drivers": "lower activity, pricing or timing differences",
  "adv_drivers": "higher activity, pricing or timing differences",
  "fav_action": "Confirm whether the variance is timing or permanent and check accrual completeness.",
  "adv_action": "Obtain a root-cause analysis split between volume, price and timing; agree corrective action with the budget holder.",
  "owner": "Budget holder",
  "standard": ""
 }
};
const SAMPLE: [string, string, string, number, number][] = [
  ["BU3", "Revenue", "Enterprise SaaS Subscriptions", 508000, 454000],
  ["BU3", "Revenue", "Mid-Market SaaS Subscriptions", 831000, 756000],
  ["BU3", "Revenue", "SMB SaaS Subscriptions", 1620000, 1530000],
  ["BU3", "Revenue", "Professional Services - Implementation", 452000, 488000],
  ["BU3", "Revenue", "Professional Services - Training", 879000, 864000],
  ["BU3", "Revenue", "Managed Services & Premium Support", 997000, 940000],
  ["BU3", "Revenue", "Channel Partner Revenue", 1573000, 1463000],
  ["BU3", "Revenue", "Usage & Overage Fees", 965000, 824000],
  ["BU3", "Cost of Goods Sold (COGS)", "Cloud Hosting & Infrastructure (AWS/GCP)", 1340000, 1154000],
  ["BU3", "Cost of Goods Sold (COGS)", "Third-Party API & Software Licenses", 900000, 963000],
  ["BU3", "Cost of Goods Sold (COGS)", "Customer Support Payroll & Benefits", 817000, 767000],
  ["BU3", "Cost of Goods Sold (COGS)", "Professional Services Delivery Cost", 864000, 833000],
  ["BU3", "Cost of Goods Sold (COGS)", "Customer Success Allocation", 1432000, 1615000],
  ["BU3", "Cost of Goods Sold (COGS)", "Data Center Operations & Telecoms", 1194000, 1123000],
  ["BU3", "Research & Development (R&D)", "Engineering Payroll", 1337000, 1496000],
  ["BU3", "Research & Development (R&D)", "Product Management Payroll", 1513000, 1528000],
  ["BU3", "Research & Development (R&D)", "QA & Testing Systems", 553000, 610000],
  ["BU3", "Research & Development (R&D)", "R&D Software Subscriptions", 1275000, 1282000],
  ["BU3", "Research & Development (R&D)", "Contractors & External Dev Agencies", 748000, 707000],
  ["BU3", "Sales & Marketing (S&M)", "Sales Base Salaries", 574000, 504000],
  ["BU3", "Sales & Marketing (S&M)", "Sales Commissions & Bonuses", 1334000, 1433000],
  ["BU3", "Sales & Marketing (S&M)", "Digital Advertising (Paid Search/Social)", 503000, 569000],
  ["BU3", "Sales & Marketing (S&M)", "Field Marketing & Regional Events", 1579000, 1350000],
  ["BU3", "Sales & Marketing (S&M)", "Brand & PR Campaigns", 701000, 704000],
  ["BU3", "Sales & Marketing (S&M)", "Travel & Entertainment (S&M)", 810000, 891000],
  ["BU3", "Sales & Marketing (S&M)", "MarTech Stack Subscriptions (CRM/Hubspot)", 838000, 880000],
  ["BU3", "General & Administrative (G&A)", "Executive & HQ Payroll", 1155000, 1087000],
  ["BU3", "General & Administrative (G&A)", "Legal & Regulatory Compliance Fees", 1482000, 1665000],
  ["BU3", "General & Administrative (G&A)", "Accounting, Audit & Tax Advisory", 637000, 639000],
  ["BU3", "General & Administrative (G&A)", "Recruiting & HR Systems", 1381000, 1280000],
  ["BU3", "General & Administrative (G&A)", "Office Rent & Facilities", 274000, 272000],
  ["BU3", "General & Administrative (G&A)", "Corporate Insurance & Overhead", 1344000, 1287000],
  ["BU3", "General & Administrative (G&A)", "Bad Debt Expense", 1320000, 1127000],
  ["BU2", "Revenue", "Enterprise SaaS Subscriptions", 981000, 967000],
  ["BU2", "Revenue", "Mid-Market SaaS Subscriptions", 443000, 386000],
  ["BU2", "Revenue", "SMB SaaS Subscriptions", 506000, 461000],
  ["BU2", "Revenue", "Professional Services - Implementation", 419000, 462000],
  ["BU2", "Revenue", "Professional Services - Training", 999000, 964000],
  ["BU2", "Revenue", "Managed Services & Premium Support", 915000, 936000],
  ["BU2", "Revenue", "Channel Partner Revenue", 1056000, 956000],
  ["BU2", "Revenue", "Usage & Overage Fees", 234000, 222000],
  ["BU2", "Cost of Goods Sold (COGS)", "Cloud Hosting & Infrastructure (AWS/GCP)", 389000, 403000],
  ["BU2", "Cost of Goods Sold (COGS)", "Third-Party API & Software Licenses", 560000, 582000],
  ["BU2", "Cost of Goods Sold (COGS)", "Customer Support Payroll & Benefits", 378000, 337000],
  ["BU2", "Cost of Goods Sold (COGS)", "Professional Services Delivery Cost", 208000, 235000],
  ["BU2", "Cost of Goods Sold (COGS)", "Customer Success Allocation", 819000, 737000],
  ["BU2", "Cost of Goods Sold (COGS)", "Data Center Operations & Telecoms", 773000, 877000],
  ["BU2", "Research & Development (R&D)", "Engineering Payroll", 298000, 317000],
  ["BU2", "Research & Development (R&D)", "Product Management Payroll", 654000, 595000],
  ["BU2", "Research & Development (R&D)", "QA & Testing Systems", 512000, 482000],
  ["BU2", "Research & Development (R&D)", "R&D Software Subscriptions", 694000, 703000],
  ["BU2", "Research & Development (R&D)", "Contractors & External Dev Agencies", 241000, 209000],
  ["BU2", "Sales & Marketing (S&M)", "Sales Base Salaries", 411000, 385000],
  ["BU2", "Sales & Marketing (S&M)", "Sales Commissions & Bonuses", 180000, 200000],
  ["BU2", "Sales & Marketing (S&M)", "Digital Advertising (Paid Search/Social)", 661000, 612000],
  ["BU2", "Sales & Marketing (S&M)", "Field Marketing & Regional Events", 289000, 273000],
  ["BU2", "Sales & Marketing (S&M)", "Brand & PR Campaigns", 1104000, 963000],
  ["BU2", "Sales & Marketing (S&M)", "Travel & Entertainment (S&M)", 895000, 977000],
  ["BU2", "Sales & Marketing (S&M)", "MarTech Stack Subscriptions (CRM/Hubspot)", 763000, 672000],
  ["BU2", "General & Administrative (G&A)", "Executive & HQ Payroll", 177000, 169000],
  ["BU2", "General & Administrative (G&A)", "Legal & Regulatory Compliance Fees", 964000, 1008000],
  ["BU2", "General & Administrative (G&A)", "Accounting, Audit & Tax Advisory", 1076000, 1038000],
  ["BU2", "General & Administrative (G&A)", "Recruiting & HR Systems", 164000, 180000],
  ["BU2", "General & Administrative (G&A)", "Office Rent & Facilities", 631000, 671000],
  ["BU2", "General & Administrative (G&A)", "Corporate Insurance & Overhead", 1003000, 981000],
  ["BU2", "General & Administrative (G&A)", "Bad Debt Expense", 294000, 270000],
  ["BU1", "Revenue", "Enterprise SaaS Subscriptions", 363000, 380000],
  ["BU1", "Revenue", "Mid-Market SaaS Subscriptions", 562000, 539000],
  ["BU1", "Revenue", "SMB SaaS Subscriptions", 393000, 414000],
  ["BU1", "Revenue", "Professional Services - Implementation", 196000, 185000],
  ["BU1", "Revenue", "Professional Services - Training", 218000, 235000],
  ["BU1", "Revenue", "Managed Services & Premium Support", 465000, 436000],
  ["BU1", "Revenue", "Channel Partner Revenue", 464000, 434000],
  ["BU1", "Revenue", "Usage & Overage Fees", 485000, 477000],
  ["BU1", "Cost of Goods Sold (COGS)", "Cloud Hosting & Infrastructure (AWS/GCP)", 431000, 461000],
  ["BU1", "Cost of Goods Sold (COGS)", "Third-Party API & Software Licenses", 650000, 568000],
  ["BU1", "Cost of Goods Sold (COGS)", "Customer Support Payroll & Benefits", 531000, 473000],
  ["BU1", "Cost of Goods Sold (COGS)", "Professional Services Delivery Cost", 294000, 298000],
  ["BU1", "Cost of Goods Sold (COGS)", "Customer Success Allocation", 185000, 203000],
  ["BU1", "Cost of Goods Sold (COGS)", "Data Center Operations & Telecoms", 339000, 316000],
  ["BU1", "Research & Development (R&D)", "Engineering Payroll", 528000, 469000],
  ["BU1", "Research & Development (R&D)", "Product Management Payroll", 521000, 536000],
  ["BU1", "Research & Development (R&D)", "QA & Testing Systems", 532000, 515000],
  ["BU1", "Research & Development (R&D)", "R&D Software Subscriptions", 491000, 479000],
  ["BU1", "Research & Development (R&D)", "Contractors & External Dev Agencies", 205000, 224000],
  ["BU1", "Sales & Marketing (S&M)", "Sales Base Salaries", 477000, 500000],
  ["BU1", "Sales & Marketing (S&M)", "Sales Commissions & Bonuses", 297000, 314000],
  ["BU1", "Sales & Marketing (S&M)", "Digital Advertising (Paid Search/Social)", 407000, 373000],
  ["BU1", "Sales & Marketing (S&M)", "Field Marketing & Regional Events", 141000, 157000],
  ["BU1", "Sales & Marketing (S&M)", "Brand & PR Campaigns", 415000, 355000],
  ["BU1", "Sales & Marketing (S&M)", "Travel & Entertainment (S&M)", 430000, 395000],
  ["BU1", "Sales & Marketing (S&M)", "MarTech Stack Subscriptions (CRM/Hubspot)", 312000, 322000],
  ["BU1", "General & Administrative (G&A)", "Executive & HQ Payroll", 547000, 464000],
  ["BU1", "General & Administrative (G&A)", "Legal & Regulatory Compliance Fees", 541000, 509000],
  ["BU1", "General & Administrative (G&A)", "Accounting, Audit & Tax Advisory", 477000, 475000],
  ["BU1", "General & Administrative (G&A)", "Recruiting & HR Systems", 612000, 531000],
  ["BU1", "General & Administrative (G&A)", "Office Rent & Facilities", 359000, 331000],
  ["BU1", "General & Administrative (G&A)", "Corporate Insurance & Overhead", 124000, 121000],
  ["BU1", "General & Administrative (G&A)", "Bad Debt Expense", 516000, 493000]
];

const CAT_ORDER = ["Revenue", "COGS", "R&D", "S&M", "G&A", "Other Opex"];
const OPEX_NAMES: Record<string, string> = { "R&D": "Research & Development", "S&M": "Sales & Marketing", "G&A": "General & Administrative", "Other Opex": "Other Operating Expenses" };

// Validated chart palette: blue = favourable, red = adverse, grey = totals
const C = { fav: "#2a78d6", adv: "#e34948", total: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", ink: "#0b0b0b", ink2: "#52514e", muted: "#898781" };

// ============================================================================ formatting
const money = (x: number, cur = "$", signed = false) => {
  if (x === null || x === undefined || Number.isNaN(x)) return "n/a";
  const sign = x < 0 ? "-" : signed && x > 0 ? "+" : "";
  const a = Math.abs(x);
  const body = a >= 1e9 ? `${(a / 1e9).toFixed(2)}bn` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}m` : a >= 1e3 ? `${Math.round(a / 1e3).toLocaleString()}k` : `${Math.round(a)}`;
  return `${sign}${cur}${body}`;
};
const pct = (x: number, signed = false, dp = 1) => {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  const v = (x * 100).toFixed(dp);
  return signed && x > 0 ? `+${v}%` : `${v}%`;
};
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)} pp`;
const num = (x: number) => Math.round(x).toLocaleString("en-US");
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

// ============================================================================ engine
const ALIASES: Record<string, string[]> = {
  Segment: ["segment", "business unit", "bu", "division"],
  Category: ["financial category", "category", "p&l category", "line group"],
  Account: ["account line item", "account", "line item", "gl account", "account name"],
  Actual: ["actual ($)", "actual", "actuals", "actual amount"],
  Budget: ["budget ($)", "budget", "plan", "budget amount"],
  VarSrc: ["variance ($)", "variance"],
  PctSrc: ["variance (%)", "variance %", "variance pct"],
};

function mapRecords(records: Record<string, any>[]): Raw[] {
  if (!records.length) throw new Error("The file contains no rows.");
  const cols = Object.keys(records[0]);
  const map: Record<string, string> = {};
  for (const [canon, al] of Object.entries(ALIASES)) {
    const hit = cols.find((c) => al.includes(String(c).trim().toLowerCase()));
    if (hit) map[canon] = hit;
  }
  const missing = ["Segment", "Category", "Account", "Actual", "Budget"].filter((k) => !map[k]);
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(", ")}`);
  const toNum = (v: any) => (v === "" || v === null || v === undefined ? NaN : Number(String(v).replace(/[,\s$]/g, "")));
  return records.map((r) => ({
    Segment: String(r[map.Segment]).trim(), Category: String(r[map.Category]).trim(), Account: String(r[map.Account]).trim(),
    Actual: toNum(r[map.Actual]), Budget: toNum(r[map.Budget]),
    VarSrc: map.VarSrc ? toNum(r[map.VarSrc]) : undefined, PctSrc: map.PctSrc ? toNum(r[map.PctSrc]) : undefined,
  }));
}

function parseCSV(text: string): Record<string, any>[] {
  const rows: string[][] = []; let row: string[] = []; let f = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

const loadXLSX = async (): Promise<any> => {
  // @ts-ignore - remote ES module, loaded only when needed
  const m = await import(/* @vite-ignore */ "https://esm.sh/xlsx@0.18.5");
  return m.default ?? m;
};

function classify(cat: string): string {
  const c = cat.toLowerCase();
  if (c.startsWith("revenue") || ["income", "turnover", "sales revenue"].includes(c) || (c.includes("revenue") && !c.includes("cost"))) return "Revenue";
  if (c.includes("cogs") || c.includes("cost of goods") || c.includes("cost of sales") || c.includes("cost of revenue")) return "COGS";
  if (c.includes("r&d") || c.includes("research")) return "R&D";
  if (c.includes("s&m") || c.includes("marketing")) return "S&M";
  if (c.includes("g&a") || c.includes("general") || c.includes("admin")) return "G&A";
  return "Other Opex";
}

const lookup = (acct: string): KB => {
  const a = acct.toLowerCase();
  return KB_DATA.kb.find((e) => (e.keywords || []).some((k) => a.includes(k))) || KB_DATA.def;
};

function lineCommentary(r: Row, s: Settings) {
  const kb = lookup(r.Account);
  const fav = r.FU === "Favourable";
  if (r.FU === "On budget")
    return { Commentary: `${r.Account} is in line with budget at ${money(r.Actual, s.cur)}.`, Drivers: "", Action: "No action required.", Nature: kb.nature, Owner: kb.owner, Standard: kb.standard };
  const drivers = fav ? kb.fav_drivers : kb.adv_drivers;
  let t = `${r.Account} (${r.Segment}) of ${money(r.Actual, s.cur)} is ${money(Math.abs(r.Variance), s.cur)} (${pct(Math.abs(r.VariancePct))}) ${r.Variance > 0 ? "above" : "below"} budget, a ${r.FU.toLowerCase()} variance to operating profit. `;
  if (r.Material) t += "The variance exceeds the materiality threshold and requires a documented explanation. ";
  t += `Typical drivers for a ${kb.nature.toLowerCase()} line: ${drivers}.`;
  if (fav && !r.IsRevenue && r.Material) t += " Cost underspends should be validated as permanent savings before being reported as such; timing differences and incomplete accruals are the most common causes.";
  return { Commentary: t, Drivers: drivers, Action: fav ? kb.fav_action : kb.adv_action, Nature: kb.nature, Owner: kb.owner, Standard: kb.standard };
}

function prepare(raw: Raw[], s: Settings) {
  const checks: { Check: string; Result: string; Detail: string }[] = [];
  const valid = raw.filter((r) => Number.isFinite(r.Actual) && Number.isFinite(r.Budget));
  checks.push({ Check: "Numeric Actual and Budget values", Result: valid.length === raw.length ? "Pass" : "Warning", Detail: `${raw.length - valid.length} row(s) excluded for blank/non-numeric amounts.` });
  const keys = valid.map((r) => `${r.Segment}|${r.Category}|${r.Account}`);
  const dups = keys.filter((k, i) => keys.indexOf(k) !== i).length;
  checks.push({ Check: "Duplicate Segment / Category / Account keys", Result: dups ? "Warning" : "Pass", Detail: dups ? `${dups} duplicated row(s).` : "No duplicates." });

  let badV = 0, badP = 0, hasV = false, hasP = false;
  const rows: Row[] = valid.map((r) => {
    const Variance = r.Actual - r.Budget;
    const VariancePct = r.Budget !== 0 ? Variance / Math.abs(r.Budget) : NaN;
    if (r.VarSrc !== undefined && Number.isFinite(r.VarSrc)) { hasV = true; if (Math.abs(r.VarSrc - Variance) > 1) badV++; }
    if (r.PctSrc !== undefined && Number.isFinite(r.PctSrc)) { hasP = true; const p = Math.abs(r.PctSrc) > 2 ? r.PctSrc / 100 : r.PctSrc; if (Math.abs(p - VariancePct) > 0.0005) badP++; }
    const Type = classify(r.Category); const IsRevenue = Type === "Revenue";
    const Impact = IsRevenue ? Variance : -Variance;
    const FU: FU = Impact > 0 ? "Favourable" : Impact < 0 ? "Adverse" : "On budget";
    const amtHit = Math.abs(Variance) >= s.amt;
    const pctHit = Math.abs(VariancePct) >= s.pctThr && Math.abs(Variance) >= s.floor;
    const Material = s.rule === "Either" ? amtHit || pctHit : amtHit && pctHit;
    const near = Math.abs(Variance) >= 0.5 * s.amt || Math.abs(VariancePct) >= 0.5 * s.pctThr;
    const RAG = Material && FU === "Adverse" ? "Red" : (Material && FU === "Favourable" && !IsRevenue) || (FU === "Adverse" && near) ? "Amber" : "Green";
    const base = { ...r, Variance, VariancePct, Type, IsRevenue, Impact, FU, Material, RAG } as Row;
    return { ...base, ...lineCommentary(base, s) };
  });
  if (hasV) checks.push({ Check: "Source Variance ($) = Actual − Budget", Result: badV ? "Warning" : "Pass", Detail: badV ? `${badV} row(s) differ; recalculated values used.` : "All rows reconcile." });
  if (hasP) checks.push({ Check: "Source Variance (%) = Variance ÷ Budget", Result: badP ? "Warning" : "Pass", Detail: badP ? `${badP} row(s) differ; recalculated values used.` : "All rows reconcile (to 4 d.p.)." });
  const zb = rows.filter((r) => r.Budget === 0).length;
  if (zb) checks.push({ Check: "Zero budget lines", Result: "Warning", Detail: `${zb} line(s) have zero budget; % variance not meaningful.` });
  const cmap = [...new Set(rows.map((r) => `${r.Category} → ${r.Type}`))].join("; ");
  checks.push({ Check: "Category classification", Result: rows.some((r) => r.Type === "Other Opex") ? "Info" : "Pass", Detail: cmap });
  return { rows, checks };
}

function plSummary(rows: Row[]) {
  const tot = (t: string, k: "Actual" | "Budget") => sum(rows.filter((r) => r.Type === t).map((r) => r[k]));
  const mk = (Line: string, A: number, B: number, IsCost: boolean, bold = false) => {
    const Variance = A - B; const Impact = IsCost ? -Variance : Variance;
    return { Line, Actual: A, Budget: B, Variance, VariancePct: B ? Variance / Math.abs(B) : NaN, Impact, FU: (Impact > 0 ? "Favourable" : Impact < 0 ? "Adverse" : "On budget") as FU, bold };
  };
  const rA = tot("Revenue", "Actual"), rB = tot("Revenue", "Budget"), cA = tot("COGS", "Actual"), cB = tot("COGS", "Budget");
  const opex = ["R&D", "S&M", "G&A", "Other Opex"].filter((t) => rows.some((r) => r.Type === t));
  const oA = sum(opex.map((t) => tot(t, "Actual"))), oB = sum(opex.map((t) => tot(t, "Budget")));
  return [
    mk("Revenue", rA, rB, false), mk("Cost of Goods Sold", cA, cB, true), mk("Gross Profit", rA - cA, rB - cB, false, true),
    ...opex.map((t) => mk(OPEX_NAMES[t], tot(t, "Actual"), tot(t, "Budget"), true)),
    mk("Total Operating Expenses", oA, oB, true, true), mk("Operating Profit / (Loss)", rA - cA - oA, rB - cB - oB, false, true),
  ];
}

function kpis(rows: Row[]) {
  const p = Object.fromEntries(plSummary(rows).map((l) => [l.Line, l]));
  const sd = (a: number, b: number) => (b ? a / b : NaN);
  const rev = p["Revenue"], gp = p["Gross Profit"], op = p["Operating Profit / (Loss)"], ox = p["Total Operating Expenses"];
  return {
    rev_a: rev.Actual, rev_b: rev.Budget, gp_a: gp.Actual, gp_b: gp.Budget, op_a: op.Actual, op_b: op.Budget, opex_a: ox.Actual, opex_b: ox.Budget,
    gm_a: sd(gp.Actual, rev.Actual), gm_b: sd(gp.Budget, rev.Budget), opr_a: sd(ox.Actual, rev.Actual), opr_b: sd(ox.Budget, rev.Budget),
  };
}

const segments = (rows: Row[]) => [...new Set(rows.map((r) => r.Segment))].sort();
const pick = (d: Row[], ...keys: string[]) => d.filter((r) => keys.some((k) => r.Account.toLowerCase().includes(k)));
const agg = (d: Row[]) => { const a = sum(d.map((r) => r.Actual)), b = sum(d.map((r) => r.Budget)); return { a, b, v: a - b, p: b ? (a - b) / b : NaN }; };

function crossChecks(rows: Row[], s: Settings): Check[] {
  const out: Check[] = []; const cur = s.cur;
  for (const seg of segments(rows)) {
    const d = rows.filter((r) => r.Segment === seg);
    const add = (Test: string, Severity: Check["Severity"], Finding: string, Action: string) => out.push({ Segment: seg, Test, Severity, Finding, Action });

    const subs = pick(d, "saas subscription", "subscription revenue"), comm = pick(d, "commission");
    if (subs.length && comm.length) {
      const S = agg(subs), Cm = agg(comm);
      if (S.p > 0.02 && Cm.p < -0.02) add("Commissions vs subscription revenue", "High", `Subscription revenue is ${pct(S.p, true)} vs budget while sales commissions are ${pct(Cm.p, true)}. Variable compensation is moving opposite to revenue.`, "Verify completeness of the commission accrual and the IFRS 15 contract-cost amortisation; confirm whether plan design or quota changes explain the gap.");
      else if (S.p < -0.02 && Cm.p > 0.02) add("Commissions vs subscription revenue", "High", `Commissions are ${pct(Cm.p, true)} vs budget while subscription revenue is ${pct(S.p, true)}.`, "Investigate commission payouts not supported by bookings (SPIFFs, guarantees, plan errors).");
      else add("Commissions vs subscription revenue", "Info", `Commissions (${pct(Cm.p, true)}) and subscription revenue (${pct(S.p, true)}) move consistently.`, "None.");
    }
    const host = pick(d, "cloud hosting", "infrastructure"), usage = pick(d, "usage", "overage");
    if (host.length && usage.length) {
      const H = agg(host), U = agg(usage); const gap = H.p - U.p;
      if (gap > 0.05) add("Hosting cost vs usage revenue", "Medium", `Cloud hosting is ${pct(H.p, true)} vs budget, outpacing usage revenue (${pct(U.p, true)}) by ${(gap * 100).toFixed(1)} pp: unit economics are deteriorating.`, "Commission a FinOps review of unit cost per customer and reserved-capacity coverage.");
      else if (H.p > 0.05 && U.p > 0.05) add("Hosting cost vs usage revenue", "Info", `Hosting overspend (${pct(H.p, true)}) is matched by usage revenue growth (${pct(U.p, true)}); the overspend is volume-driven and margin-neutral to accretive.`, "None; monitor unit cost.");
      else add("Hosting cost vs usage revenue", "Info", `Hosting ${pct(H.p, true)}, usage revenue ${pct(U.p, true)}; no adverse divergence.`, "None.");
    }
    const eng = pick(d, "engineering payroll"), con = pick(d, "contractor", "external dev");
    if (eng.length && con.length) {
      const E = agg(eng), K = agg(con);
      if (E.v < 0 && K.v > 0) add("Engineering payroll vs contractors", "Medium",
        `Engineering payroll is ${money(E.v, cur, true)} (${pct(E.p, true)}) while contractors are ${money(K.v, cur, true)} (${pct(K.p, true)}). ` +
        (K.v > -E.v ? `Contractor overspend exceeds the payroll saving; net cost increase of ${money(E.v + K.v, cur)}.` : `Contractors absorb ${Math.round((K.v / -E.v) * 100)}% of the payroll saving; net cost saving of ${money(-(E.v + K.v), cur)}.`),
        "Confirm vacancies are being back-filled with contractors at a premium; assess conversion to permanent hires and roadmap impact.");
      else if (E.v > 0 && K.v > 0) add("Engineering payroll vs contractors", "Medium", `Both engineering payroll (${pct(E.p, true)}) and contractors (${pct(K.p, true)}) are above budget.`, "Obtain a capacity plan reconciling FTE plus contractors to approved headcount.");
    }
    const psR = pick(d.filter((r) => r.IsRevenue), "implementation", "training"), psC = pick(d.filter((r) => !r.IsRevenue), "delivery cost");
    if (psR.length && psC.length) {
      const R = agg(psR), Q = agg(psC); const ma = (R.a - Q.a) / R.a, mb = (R.b - Q.b) / R.b; const sev = ma < mb - 0.03 ? "Medium" : "Info";
      add("Professional services margin", sev, `PS gross margin ${pct(ma)} vs budget ${pct(mb)} (${pp(ma - mb)}). PS revenue ${money(R.v, cur, true)}, delivery cost ${money(Q.v, cur, true)}.`, sev !== "Info" ? "Review project-level margins and fixed-fee overruns." : "None.");
    }
    const rec = pick(d, "recruiting"), pay = d.filter((r) => /payroll|salar/i.test(r.Account));
    if (rec.length && pay.length) {
      const Rc = agg(rec), P = agg(pay);
      if (Rc.v > 0 && P.v < 0) add("Recruiting spend vs payroll", "Medium", `Recruiting is ${money(Rc.v, cur, true)} (${pct(Rc.p, true)}) over budget while total payroll is ${money(P.v, cur, true)} under. Hiring spend is not converting into filled roles.`, "Review time-to-hire, offer-acceptance rates and agency mix.");
    }
    const bd = pick(d, "bad debt", "doubtful"), rev = d.filter((r) => r.IsRevenue);
    if (bd.length && rev.length) {
      const B = agg(bd), R = agg(rev); const share = B.a / R.a;
      if (B.p - R.p > 0.05) add("Bad debt vs revenue", "High", `Bad debt expense is ${pct(B.p, true)} vs budget against revenue ${pct(R.p, true)}; bad debt equals ${pct(share)} of revenue. Credit losses are growing faster than the revenue base.`, "Obtain the debtor ageing and IFRS 9 ECL matrix; identify customers driving the charge and tighten credit terms.");
      else add("Bad debt vs revenue", "Info", `Bad debt ${pct(B.p, true)} vs revenue ${pct(R.p, true)}; bad debt is ${pct(share)} of revenue.`, "None.");
    }
    const k = kpis(d);
    if (Number.isFinite(k.gm_a)) {
      const dl = k.gm_a - k.gm_b;
      add("Gross margin vs budget", dl < -0.02 ? "High" : dl < 0 ? "Medium" : "Info", `Gross margin ${pct(k.gm_a)} vs budget ${pct(k.gm_b)} (${pp(dl)}).`, dl < 0 ? "Analyse COGS lines for cost growth ahead of revenue." : "None.");
    }
    const al = pick(d, "allocation");
    if (al.length) { const A = agg(al); if (Math.abs(A.v) >= s.amt) add("Internal allocations", "Info", `Allocated cost differs from budget by ${money(A.v, cur, true)} (${pct(A.p, true)}). This shifts cost between segments and nets out at group level.`, "Confirm the allocation key is unchanged from budget before using it to judge segment performance."); }
  }
  const ord = { High: 0, Medium: 1, Info: 2 };
  return out.sort((a, b) => ord[a.Severity] - ord[b.Severity] || a.Segment.localeCompare(b.Segment));
}

const byImpact = (d: Row[]) => [...d].sort((a, b) => Math.abs(b.Impact) - Math.abs(a.Impact));
const driverList = (d: Row[], fav: boolean, n: number, cur: string) =>
  byImpact(d.filter((r) => r.FU === (fav ? "Favourable" : "Adverse"))).slice(0, n).map((r) => `${r.Account} - ${r.Segment} (${money(r.Impact, cur, true)})`).join("; ");

function executiveSummary(rows: Row[], checks: Check[], s: Settings): [string, string][] {
  const cur = s.cur, k = kpis(rows), pl = Object.fromEntries(plSummary(rows).map((l) => [l.Line, l]));
  const out: [string, string][] = [];
  const opv = k.op_a - k.op_b, rv = k.rev_a - k.rev_b;
  const res = (v: number) => `operating ${v >= 0 ? "profit" : "loss"} of ${money(Math.abs(v), cur)}`;
  let h = `For ${s.period}, the group reported an ${res(k.op_a)} against a budgeted ${res(k.op_b)}, ${opv >= 0 ? "a favourable" : "an adverse"} variance of ${money(Math.abs(opv), cur)}. `;
  h += `Revenue of ${money(k.rev_a, cur)} was ${money(Math.abs(rv), cur)} (${pct(rv / k.rev_b, true)}) ${rv >= 0 ? "ahead of" : "behind"} budget, while total costs (COGS and operating expenses) were ${money(pl["Cost of Goods Sold"].Variance + pl["Total Operating Expenses"].Variance, cur, true)} vs budget.`;
  if (rv > 0 && opv < 0) h += " The revenue outperformance did not convert into profit: cost growth absorbed the full revenue gain.";
  else if (rv > 0 && opv > 0) h += ` Revenue outperformance converted to profit at ${Math.round((opv / rv) * 100)}% flow-through.`;
  out.push(["Headline", h]);
  let g = `Gross margin was ${pct(k.gm_a)} against a budget of ${pct(k.gm_b)} (${pp(k.gm_a - k.gm_b)}). COGS of ${money(pl["Cost of Goods Sold"].Actual, cur)} was ${pct(pl["Cost of Goods Sold"].VariancePct, true)} vs budget compared with revenue at ${pct(rv / k.rev_b, true)}. `;
  if (k.gm_a < s.gmBench) g += `The margin is below the ${pct(s.gmBench, false, 0)} reference level set in this analysis; the cost-to-serve structure (hosting, support and delivery) warrants review.`;
  out.push(["Gross margin", g]);
  let o = `Operating expenses were ${money(k.opex_a, cur)} vs budget ${money(k.opex_b, cur)} (${pct((k.opex_a - k.opex_b) / k.opex_b, true)}), equivalent to ${pct(k.opr_a)} of revenue (budget ${pct(k.opr_b)}). `;
  for (const l of ["Research & Development", "Sales & Marketing", "General & Administrative"]) if (pl[l]) o += `${l}: ${money(pl[l].Variance, cur, true)} (${pct(pl[l].VariancePct, true)}). `;
  out.push(["Operating expenses", o.trim()]);
  out.push(["Principal adverse drivers (profit impact)", driverList(rows, false, 5, cur) + "."]);
  out.push(["Principal favourable drivers (profit impact)", driverList(rows, true, 5, cur) + "."]);
  const hi = checks.filter((c) => c.Severity === "High");
  if (hi.length) out.push(["Analytical review: items requiring attention", hi.map((c) => `[${c.Segment}] ${c.Finding}`).join(" ")]);
  const seg = segments(rows).map((sg) => [sg, sum(rows.filter((r) => r.Segment === sg).map((r) => r.Impact))] as [string, number]).sort((a, b) => a[1] - b[1]);
  out.push(["Segment contribution to operating variance", seg.map(([n, v]) => `${n} ${money(v, cur, true)}`).join("; ") + "."]);
  const mat = rows.filter((r) => r.Material), red = rows.filter((r) => r.RAG === "Red").length;
  const recs = [`${mat.length} of ${rows.length} line items breach materiality (${money(s.amt, cur)} or ${pct(s.pctThr, false, 0)}); ${red} are adverse and are listed in the Exceptions Register with accountable owners.`];
  if (hi.length) recs.push("Management to present root-cause analysis and corrective actions for the High-severity analytical findings at the next Audit & Risk Committee.");
  if (rv > 0 && opv < 0) recs.push("Re-base the cost forecast: revenue is ahead of plan but cost growth is eroding profitability; a cost-to-revenue flex budget is recommended.");
  const fc = rows.filter((r) => r.FU === "Favourable" && !r.IsRevenue && r.Material);
  if (fc.length) recs.push(`Validate ${fc.length} material cost underspends (${money(sum(fc.map((r) => r.Impact)), cur)}) for timing and accrual completeness before they are treated as permanent savings in the forecast.`);
  out.push(["Recommendations to the Board", recs.map((r, i) => `(${i + 1}) ${r}`).join(" ")]);
  return out;
}

function segmentNarrative(rows: Row[], seg: string, checks: Check[], s: Settings) {
  const cur = s.cur, d = rows.filter((r) => r.Segment === seg), k = kpis(d);
  const opv = k.op_a - k.op_b, rv = k.rev_a - k.rev_b;
  const res = (v: number) => `${v >= 0 ? "profit" : "loss"} of ${money(Math.abs(v), cur)}`;
  let t = `${seg} delivered revenue of ${money(k.rev_a, cur)} (${pct(rv / k.rev_b, true)} vs budget) and an operating ${res(k.op_a)} against a budgeted ${res(k.op_b)}, ${opv >= 0 ? "a favourable" : "an adverse"} variance of ${money(Math.abs(opv), cur)}. Gross margin was ${pct(k.gm_a)} (${pp(k.gm_a - k.gm_b)} vs budget). `;
  const bt = CAT_ORDER.filter((c) => d.some((r) => r.Type === c)).map((c) => [c, sum(d.filter((r) => r.Type === c).map((r) => r.Impact))] as [string, number]);
  const worst = bt.reduce((a, b) => (b[1] < a[1] ? b : a)), best = bt.reduce((a, b) => (b[1] > a[1] ? b : a));
  t += `The largest adverse category impact was ${worst[0]} (${money(worst[1], cur, true)}); the largest favourable was ${best[0]} (${money(best[1], cur, true)}). `;
  t += `Key adverse lines: ${driverList(d, false, 3, cur)}. Key favourable lines: ${driverList(d, true, 3, cur)}.`;
  const c = checks.filter((x) => x.Segment === seg && x.Severity !== "Info");
  if (c.length) t += " Analytical review: " + c.map((x) => x.Finding).join(" ");
  return t;
}

// ============================================================================ styles
const CSS = `
:root{--bg:#f6f5f1;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;--line:rgba(11,11,11,.10);--fav:#2a78d6;--adv:#e34948;--favtxt:#104281;--advtxt:#a3201f;--accent:#1F3864}
*{box-sizing:border-box} body{margin:0}
.va{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;display:grid;grid-template-columns:300px 1fr;background:linear-gradient(to right,#efeee9 300px,var(--bg) 300px)}
.va aside{background:#efeee9;border-right:1px solid var(--line);padding:22px 20px;position:sticky;top:0;height:100vh;overflow:auto}
.va aside h1{font-size:19px;margin:0 0 4px} .va aside .sub{font-size:12.5px;color:var(--ink2);margin-bottom:18px}
.va aside h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink2);margin:20px 0 8px}
.va label{display:block;font-size:13px;color:var(--ink2);margin:10px 0 4px}
.va input[type=text],.va input[type=number],.va select{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:#fff;font:inherit;font-size:14px}
.va .seg{display:flex;gap:6px} .va .seg button{flex:1}
.va button{font:inherit;font-size:13px;padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer;color:var(--ink)}
.va button.on{background:var(--accent);color:#fff;border-color:var(--accent)} .va button:hover{filter:brightness(.97)}
.va .file{border:1.5px dashed #c3c2b7;border-radius:10px;padding:12px;text-align:center;font-size:13px;color:var(--ink2);background:#fff;cursor:pointer;display:block}
.va main{padding:26px 34px 60px;min-width:0}
.va .top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.va .top h2{font-size:28px;margin:0;letter-spacing:-.01em} .va .meta{font-size:13px;color:var(--ink2);margin-top:6px}
.va .actions{display:flex;gap:8px}
.va .tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:22px 0 20px;overflow-x:auto}
.va .tabs button{border:none;background:none;border-bottom:2px solid transparent;border-radius:0;padding:10px 12px;color:var(--ink2);white-space:nowrap}
.va .tabs button.on{border-bottom-color:var(--fav);color:var(--fav);font-weight:600;background:none}
.va .kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.va .kpi{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.va .kpi .l{font-size:12.5px;color:var(--ink2)} .va .kpi .v{font-size:24px;font-weight:600;margin:4px 0}
.va .chip{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px}
.va .chip.f{background:#dbe9fb;color:var(--favtxt)} .va .chip.a{background:#fbdcdb;color:var(--advtxt)} .va .chip.n{background:#ecebe6;color:#3d3c39} .va .chip.m{background:#fff1cc;color:#6b4a00}
.va .panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-top:16px}
.va .panel h3{margin:0 0 12px;font-size:16px}
.va .card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:10px}
.va .card h4{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink2)}
.va .card p{margin:0;line-height:1.6;font-size:14.5px}
.va .card.rec{border-color:var(--fav);box-shadow:inset 3px 0 0 var(--fav)}
.va .grid2{display:grid;grid-template-columns:1.7fr 1fr;gap:16px;align-items:start}
.va table{width:100%;border-collapse:collapse;font-size:13.5px}
.va th{text-align:left;font-weight:600;color:var(--ink2);font-size:12.5px;padding:9px 10px;border-bottom:1px solid var(--line);background:#f3f2ee;position:sticky;top:0;z-index:1}
.va td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.va td.n,.va th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.va tr.b td{font-weight:700;border-top:1px solid #c3c2b7}
.va tr.click{cursor:pointer} .va tr.click:hover td{background:#eef4fc} .va tr.sel td{background:#e3eefc}
.va .scroll{max-height:460px;overflow:auto;border:1px solid var(--line);border-radius:10px}
.va .f{color:var(--favtxt);font-weight:600} .va .a{color:var(--advtxt);font-weight:600}
.va .filters{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px}
.va .filters>div{min-width:160px}
.va .cap{font-size:12.5px;color:var(--muted);margin-top:8px}
.va .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.va .err{background:#fbdcdb;color:var(--advtxt);padding:10px 14px;border-radius:8px;margin-top:12px;font-size:13.5px}
.va .warn{background:#fff1cc;color:#6b4a00;padding:10px 14px;border-radius:8px;margin-top:12px;font-size:13.5px}
.va svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.print-only{display:none}
@media (max-width:1100px){.va{grid-template-columns:1fr;background:var(--bg)}.va aside{position:static;height:auto}.va .kpis{grid-template-columns:repeat(2,1fr)}.va .grid2{grid-template-columns:1fr}}
@media print{.va{display:none!important}.print-only{display:block;font-family:Calibri,Arial,sans-serif;color:#000;padding:10mm}
 .print-only h1{font-size:20pt;margin:0 0 4pt}.print-only h2{font-size:13pt;border-bottom:1px solid #999;margin-top:14pt}
 .print-only p{font-size:10.5pt;line-height:1.45;margin:4pt 0}.print-only table{border-collapse:collapse;width:100%;font-size:9.5pt}
 .print-only td,.print-only th{border:1px solid #bbb;padding:3pt 5pt}.print-only .n{text-align:right}}
`;

// ============================================================================ charts (SVG)
function Waterfall({ rows, cur }: { rows: Row[]; cur: string }) {
  const k = kpis(rows);
  const steps = [{ label: "Budget", v: k.op_b, kind: "total" as const },
    ...CAT_ORDER.filter((c) => rows.some((r) => r.Type === c)).map((c) => ({ label: c, v: sum(rows.filter((r) => r.Type === c).map((r) => r.Impact)), kind: "delta" as const })),
    { label: "Actual", v: k.op_a, kind: "total" as const }];
  let run = 0;
  const bars = steps.map((s, i) => {
    if (s.kind === "total") { run = s.v; return { ...s, y0: i === 0 ? s.v : s.v, y1: s.v, isTotal: true }; }
    const y0 = run; run += s.v; return { ...s, y0, y1: run, isTotal: false };
  });
  const vals = bars.flatMap((b) => [b.y0, b.y1]);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max((hi - lo) * 0.3, Math.abs(hi) * 0.002, 1); lo -= pad; hi += pad;
  const W = 980, H = 340, L = 70, R = 16, T = 26, B = 40; const iw = W - L - R, ih = H - T - B;
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * ih; const bw = iw / bars.length;
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const base = (b: (typeof bars)[number]) => (b.isTotal ? (b.v < 0 ? hi : lo) : b.y0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Operating result bridge from budget to actual">
      {ticks.map((t, i) => (<g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={C.grid} /><text x={L - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill={C.muted}>{money(t, cur)}</text></g>))}
      {bars.map((b, i) => {
        const top = Math.min(y(b.y1), y(base(b))), h = Math.max(Math.abs(y(b.y1) - y(base(b))), 2);
        const fill = b.isTotal ? C.total : b.v >= 0 ? C.fav : C.adv; const x = L + i * bw + bw * 0.18;
        const labelY = b.isTotal ? (b.v < 0 ? top + h + 15 : top - 6) : b.v >= 0 ? top - 6 : top + h + 15;
        return (<g key={i}>
          <rect x={x} y={top} width={bw * 0.64} height={h} rx={4} fill={fill}><title>{`${b.label}: ${money(b.v, cur, !b.isTotal)}`}</title></rect>
          {i < bars.length - 1 && <line x1={x + bw * 0.64} x2={x + bw} y1={y(b.isTotal ? b.v : b.y1)} y2={y(b.isTotal ? b.v : b.y1)} stroke={C.axis} strokeDasharray="3 3" />}
          <text x={x + bw * 0.32} y={labelY} fontSize="12.5" fontWeight={600} textAnchor="middle" fill={C.ink}>{money(b.v, cur, !b.isTotal)}</text>
          <text x={x + bw * 0.32} y={H - 14} fontSize="12" textAnchor="middle" fill={C.ink2}>{b.label}</text>
        </g>);
      })}
    </svg>
  );
}

function GroupedBars({ rows, cur }: { rows: Row[]; cur: string }) {
  const segs = segments(rows); const cats = CAT_ORDER.filter((c) => rows.some((r) => r.Type === c));
  const data = cats.map((c) => ({ c, v: segs.map((sg) => sum(rows.filter((r) => r.Type === c && r.Segment === sg).map((r) => r.Impact))) }));
  const m = Math.max(...data.flatMap((d) => d.v.map(Math.abs)), 1);
  const W = 980, L = 90, R = 120, rowH = 18, gap = 4, grpGap = 22; const H = cats.length * (segs.length * (rowH + gap) + grpGap) + 30;
  const mid = L + (W - L - R) / 2, half = (W - L - R) / 2; let yy = 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Profit impact by category and segment">
      <line x1={mid} x2={mid} y1={0} y2={H - 20} stroke={C.axis} />
      {data.map((d) => {
        const g0 = yy; const els = d.v.map((v, j) => {
          const w = (Math.abs(v) / m) * half, x = v >= 0 ? mid : mid - w, ty = g0 + j * (rowH + gap);
          return (<g key={j}><rect x={x} y={ty} width={Math.max(w, 1.5)} height={rowH} rx={4} fill={v >= 0 ? C.fav : C.adv}><title>{`${segs[j]} · ${d.c}: ${money(v, cur, true)}`}</title></rect>
            <text x={v >= 0 ? x + w + 6 : x - 6} y={ty + rowH - 5} fontSize="11.5" textAnchor={v >= 0 ? "start" : "end"} fill={C.ink}>{`${segs[j]}  ${money(v, cur, true)}`}</text></g>);
        });
        yy += segs.length * (rowH + gap) + grpGap;
        return (<g key={d.c}><text x={8} y={g0 + (segs.length * (rowH + gap)) / 2 + 4} fontSize="12.5" fill={C.ink2} fontWeight={600}>{d.c}</text>{els}</g>);
      })}
      <text x={mid} y={H - 4} fontSize="11" textAnchor="middle" fill={C.muted}>{`← adverse   profit impact (${cur})   favourable →`}</text>
    </svg>
  );
}

function heatColor(v: number, lim: number) {
  const t = Math.max(-1, Math.min(1, v / (lim || 1)));
  const mix = (a: number[], b: number[], f: number) => a.map((x, i) => Math.round(x + (b[i] - x) * f));
  const mid = [240, 239, 236], blue = [28, 92, 171], red = [194, 58, 58];
  const c = t >= 0 ? mix(mid, blue, t) : mix(mid, red, -t);
  return { bg: `rgb(${c.join(",")})`, fg: Math.abs(t) > 0.6 ? "#fff" : "#0b0b0b" };
}

// ============================================================================ app
export default function App() {
  const [raw, setRaw] = useState<Raw[]>(() => SAMPLE.map(([Segment, Category, Account, Actual, Budget]) => ({ Segment, Category, Account, Actual, Budget })));
  const [src, setSrc] = useState("Sample data (enterprise_multi_segment_pl.xlsx)");
  const [err, setErr] = useState("");
  const [s, setS] = useState<Settings>({ amt: 50000, pctThr: 0.1, rule: "Either", floor: 10000, gmBench: 0.7, cur: "$", period: "the current period" });
  const [tab, setTab] = useState(0);
  const [fSeg, setFSeg] = useState("All"); const [fType, setFType] = useState("All"); const [fFU, setFFU] = useState("All"); const [fMat, setFMat] = useState(false);
  const [sel, setSel] = useState<string>(""); const [sev, setSev] = useState<string[]>(["High", "Medium"]); const [advOnly, setAdvOnly] = useState(false);

  const { rows, checks: validation } = useMemo(() => prepare(raw, s), [raw, s]);
  const checks = useMemo(() => crossChecks(rows, s), [rows, s]);
  const summary = useMemo(() => executiveSummary(rows, checks, s), [rows, checks, s]);
  const k = useMemo(() => kpis(rows), [rows]);
  const pl = useMemo(() => plSummary(rows), [rows]);
  const M = (x: number, signed = false) => money(x, s.cur, signed);
  const segs = segments(rows);
  const keyOf = (r: Row) => `${r.Segment}|${r.Account}`;

  const onFile = async (f?: File) => {
    if (!f) return; setErr("");
    try {
      let recs: Record<string, any>[];
      if (/\.csv$/i.test(f.name)) recs = parseCSV(await f.text());
      else { const X = await loadXLSX(); const wb = X.read(await f.arrayBuffer(), { type: "array" });
        recs = []; for (const n of wb.SheetNames) { const r = X.utils.sheet_to_json(wb.Sheets[n], { defval: "" }); try { mapRecords(r); recs = r; break; } catch { /* try next sheet */ } }
        if (!recs.length) throw new Error("No sheet contains the required columns: Segment, Financial Category, Account Line Item, Actual, Budget."); }
      setRaw(mapRecords(recs)); setSrc(f.name); setSel("");
    } catch (e: any) { setErr(`Could not read the file: ${e.message || e}`); }
  };

  const exportExcel = async () => {
    try {
      const X = await loadXLSX(); const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([[`Variance Analysis - ${s.period}`], [], ...summary.flatMap(([h, p]) => [[h], [p], []])]), "Executive Summary");
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(pl.map((l) => ({ Line: l.Line, Actual: l.Actual, Budget: l.Budget, Variance: l.Variance, "Variance %": l.VariancePct, "F / A": l.FU }))), "P&L Summary");
      const det = (d: Row[]) => d.map((r) => ({ Segment: r.Segment, Category: r.Category, Account: r.Account, Actual: r.Actual, Budget: r.Budget, Variance: r.Variance, "Variance %": r.VariancePct, "Profit impact": r.Impact, "F / A": r.FU, Material: r.Material ? "Yes" : "No", RAG: r.RAG, Nature: r.Nature, Commentary: r.Commentary, Action: r.Action, Owner: r.Owner, Standard: r.Standard }));
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(det(rows)), "Line Detail");
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(det(byImpact(rows.filter((r) => r.Material)))), "Exceptions Register");
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(checks), "Analytical Review");
      X.writeFile(wb, "variance_analysis_pack.xlsx");
    } catch (e: any) { setErr(`Excel export failed (needs internet to load SheetJS): ${e.message || e}`); }
  };

  const filtered = rows.filter((r) => (fSeg === "All" || r.Segment === fSeg) && (fType === "All" || r.Type === fType) && (fFU === "All" || r.FU === fFU) && (!fMat || r.Material));
  const fSorted = byImpact(filtered);
  const selRow = fSorted.find((r) => keyOf(r) === sel) || fSorted[0];
  const ragDot = (g: string) => <span className="dot" style={{ background: g === "Red" ? "#d03b3b" : g === "Amber" ? "#fab219" : "#0ca30c" }} title={g} />;
  const fuCls = (f: FU) => (f === "Favourable" ? "f" : f === "Adverse" ? "a" : "");
  const chip = (cls: string, t: string) => <span className={`chip ${cls}`}>{t}</span>;
  const delta = (v: number, goodIfPositive: boolean, text: string) => chip(v === 0 ? "n" : (v > 0) === goodIfPositive ? "f" : "a", `${v > 0 ? "▲" : v < 0 ? "▼" : "•"} ${text}`);
  const warnN = validation.filter((v) => v.Result === "Warning").length;
  const TABS = ["Board summary", "P&L bridge", "Segments", "Line-item drill-down", "Exceptions register", "Analytical review", "Data & methodology"];
  const set = (p: Partial<Settings>) => setS((o) => ({ ...o, ...p }));
  const exceptions = byImpact(rows.filter((r) => r.Material && (!advOnly || r.FU === "Adverse")));
  const hm = segs.map((sg) => CAT_ORDER.filter((c) => rows.some((r) => r.Type === c)).map((c) => sum(rows.filter((r) => r.Segment === sg && r.Type === c).map((r) => r.Impact))));
  const hmCats = CAT_ORDER.filter((c) => rows.some((r) => r.Type === c)); const hmLim = Math.max(...hm.flat().map(Math.abs), 1);

  return (
    <>
      <style>{CSS}</style>
      <div className="va">
        {/* ---------------------------------------------------------------- sidebar */}
        <aside>
          <h1>📊 Variance Analysis</h1>
          <div className="sub">Actual vs Budget with rule-based CFO commentary</div>
          <label className="file">
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
            ⬆ Upload P&L (Excel or CSV)<br /><span style={{ fontSize: 11.5 }}>Segment · Financial Category · Account Line Item · Actual · Budget</span>
          </label>
          {src !== "Sample data (enterprise_multi_segment_pl.xlsx)" && <button style={{ marginTop: 8, width: "100%" }} onClick={() => { setRaw(SAMPLE.map(([Segment, Category, Account, Actual, Budget]) => ({ Segment, Category, Account, Actual, Budget }))); setSrc("Sample data (enterprise_multi_segment_pl.xlsx)"); }}>Reset to sample data</button>}
          <h3>Report settings</h3>
          <label>Reporting period</label><input type="text" value={s.period} onChange={(e) => set({ period: e.target.value })} placeholder="e.g. Q3 FY2026" />
          <label>Currency symbol</label><input type="text" maxLength={5} value={s.cur} onChange={(e) => set({ cur: e.target.value })} />
          <h3>Materiality</h3>
          <label>Absolute threshold</label><input type="number" step={5000} min={0} value={s.amt} onChange={(e) => set({ amt: Number(e.target.value) || 0 })} />
          <label>Percentage threshold: {Math.round(s.pctThr * 100)}%</label><input type="range" min={1} max={50} value={Math.round(s.pctThr * 100)} onChange={(e) => set({ pctThr: Number(e.target.value) / 100 })} style={{ width: "100%" }} />
          <label>Material when</label>
          <div className="seg">{(["Either", "Both"] as const).map((r) => <button key={r} className={s.rule === r ? "on" : ""} onClick={() => set({ rule: r })}>{r === "Either" ? "Either test" : "Both tests"}</button>)}</div>
          <label>Ignore % test below (absolute)</label><input type="number" step={1000} min={0} value={s.floor} onChange={(e) => set({ floor: Number(e.target.value) || 0 })} />
          <h3>Benchmark</h3>
          <label>Gross-margin reference level: {Math.round(s.gmBench * 100)}%</label><input type="range" min={0} max={100} value={Math.round(s.gmBench * 100)} onChange={(e) => set({ gmBench: Number(e.target.value) / 100 })} style={{ width: "100%" }} />
          <div className="cap">Used only for commentary context. Set it to your own target.</div>
        </aside>

        {/* ---------------------------------------------------------------- main */}
        <main>
          <div className="top">
            <div>
              <h2>Variance Analysis — Actual vs Budget</h2>
              <div className="meta">Period: {s.period} · Source: {src} · {rows.length} line items · {segs.length} segments · Variance = Actual − Budget · favourable = adds to operating profit</div>
            </div>
            <div className="actions"><button onClick={exportExcel}>⬇ Excel pack</button><button onClick={() => window.print()}>🖨 Board paper (PDF)</button></div>
          </div>
          {err && <div className="err">{err}</div>}
          {warnN > 0 && <div className="warn">{warnN} data validation warning(s). See Data & methodology.</div>}
          <div className="tabs">{TABS.map((t, i) => <button key={t} className={tab === i ? "on" : ""} onClick={() => setTab(i)}>{t}</button>)}</div>

          {/* 1. Board summary */}
          {tab === 0 && (<>
            <div className="kpis">
              <div className="kpi"><div className="l">Revenue</div><div className="v">{M(k.rev_a)}</div>{delta(k.rev_a - k.rev_b, true, `${M(k.rev_a - k.rev_b, true)} (${pct((k.rev_a - k.rev_b) / k.rev_b, true)})`)}</div>
              <div className="kpi"><div className="l">Gross profit</div><div className="v">{M(k.gp_a)}</div>{delta(k.gp_a - k.gp_b, true, M(k.gp_a - k.gp_b, true))}</div>
              <div className="kpi"><div className="l">Gross margin</div><div className="v">{pct(k.gm_a)}</div>{delta(k.gm_a - k.gm_b, true, pp(k.gm_a - k.gm_b))}</div>
              <div className="kpi"><div className="l">Operating expenses</div><div className="v">{M(k.opex_a)}</div>{delta(k.opex_a - k.opex_b, false, M(k.opex_a - k.opex_b, true))}</div>
              <div className="kpi"><div className="l">Operating result</div><div className="v">{M(k.op_a)}</div>{delta(k.op_a - k.op_b, true, M(k.op_a - k.op_b, true))}</div>
            </div>
            <div className="cap">Deltas are Actual − Budget; blue chip = favourable, red chip = adverse (an opex increase is adverse).</div>
            <div className="panel"><h3>Operating result bridge: Budget → Actual (profit impact by category)</h3><Waterfall rows={rows} cur={s.cur} />
              <div className="cap">Blue = favourable, red = adverse, grey = budget / actual. Value axis is zoomed to the movement range so category effects are visible.</div></div>
            <h3 style={{ margin: "26px 0 12px", fontSize: 20 }}>Executive commentary</h3>
            <div className="grid2">
              <div>{summary.slice(0, -1).map(([h, p]) => <div className="card" key={h}><h4>{h}</h4><p>{p}</p></div>)}</div>
              <div>
                <div className="card rec"><h4>{summary[summary.length - 1][0]}</h4><p>{summary[summary.length - 1][1]}</p></div>
                <div className="card"><h4>Line-item status</h4><p>{ragDot("Red")}Red {rows.filter((r) => r.RAG === "Red").length} — material adverse<br />{ragDot("Amber")}Amber {rows.filter((r) => r.RAG === "Amber").length} — near threshold, or material cost underspend to validate<br />{ragDot("Green")}Green {rows.filter((r) => r.RAG === "Green").length}</p></div>
              </div>
            </div>
          </>)}

          {/* 2. P&L bridge */}
          {tab === 1 && (<>
            <div className="panel"><h3>Management P&L — Actual vs Budget</h3>
              <table><thead><tr><th>Line</th><th className="n">Actual</th><th className="n">Budget</th><th className="n">Variance</th><th className="n">Var %</th><th>Favourable / Adverse</th></tr></thead>
                <tbody>{pl.map((l) => <tr key={l.Line} className={l.bold ? "b" : ""}><td>{l.Line}</td><td className="n">{num(l.Actual)}</td><td className="n">{num(l.Budget)}</td><td className="n">{(l.Variance > 0 ? "+" : "") + num(l.Variance)}</td><td className="n">{pct(l.VariancePct, true)}</td><td className={fuCls(l.FU)}>{l.FU}</td></tr>)}</tbody></table></div>
            <div className="panel"><h3>Profit impact by category and segment</h3><GroupedBars rows={rows} cur={s.cur} /></div>
          </>)}

          {/* 3. Segments */}
          {tab === 2 && (<>
            <div className="panel"><h3>Segment performance</h3>
              <table><thead><tr><th>Segment</th><th className="n">Revenue A</th><th className="n">Revenue B</th><th className="n">GM% A</th><th className="n">GM% B</th><th className="n">Opex A</th><th className="n">Opex B</th><th className="n">OP A</th><th className="n">OP B</th><th className="n">OP variance</th></tr></thead>
                <tbody>{segs.map((sg) => { const q = kpis(rows.filter((r) => r.Segment === sg)); const v = q.op_a - q.op_b; return (
                  <tr key={sg}><td><b>{sg}</b></td><td className="n">{num(q.rev_a)}</td><td className="n">{num(q.rev_b)}</td><td className="n">{pct(q.gm_a)}</td><td className="n">{pct(q.gm_b)}</td><td className="n">{num(q.opex_a)}</td><td className="n">{num(q.opex_b)}</td><td className="n">{num(q.op_a)}</td><td className="n">{num(q.op_b)}</td><td className={`n ${v >= 0 ? "f" : "a"}`}>{(v > 0 ? "+" : "") + num(v)}</td></tr>); })}</tbody></table>
              <div className="cap">A = Actual, B = Budget, GM = Gross margin, OP = Operating profit / (loss).</div></div>
            <div className="panel"><h3>Profit impact heatmap</h3>
              <table><thead><tr><th>Segment</th>{hmCats.map((c) => <th key={c} className="n" style={{ textAlign: "center" }}>{c}</th>)}<th className="n">Total</th></tr></thead>
                <tbody>{segs.map((sg, i) => <tr key={sg}><td><b>{sg}</b></td>{hm[i].map((v, j) => { const hc = heatColor(v, hmLim); return <td key={j} style={{ background: hc.bg, color: hc.fg, textAlign: "center", fontWeight: 600, border: "2px solid #fcfcfb" }} title={`${sg} · ${hmCats[j]}: ${M(v, true)}`}>{M(v, true)}</td>; })}<td className={`n ${sum(hm[i]) >= 0 ? "f" : "a"}`}>{M(sum(hm[i]), true)}</td></tr>)}</tbody></table>
              <div className="cap">Red = adverse to profit · grey = neutral · blue = favourable. Intensity scales with size.</div></div>
            <div className="panel"><h3>Segment commentary</h3>{segs.map((sg) => <div className="card" key={sg}><h4>{sg} — operating variance {M(sum(rows.filter((r) => r.Segment === sg).map((r) => r.Impact)), true)}</h4><p>{segmentNarrative(rows, sg, checks, s)}</p></div>)}</div>
          </>)}

          {/* 4. Drill-down */}
          {tab === 3 && (<>
            <div className="filters">
              <div><label>Segment</label><select value={fSeg} onChange={(e) => setFSeg(e.target.value)}><option>All</option>{segs.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label>Category</label><select value={fType} onChange={(e) => setFType(e.target.value)}><option>All</option>{CAT_ORDER.filter((c) => rows.some((r) => r.Type === c)).map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label>Favourable / Adverse</label><select value={fFU} onChange={(e) => setFFU(e.target.value)}><option>All</option><option>Favourable</option><option>Adverse</option></select></div>
              <div><button className={fMat ? "on" : ""} onClick={() => setFMat(!fMat)}>{fMat ? "✓ " : ""}Material only</button></div>
            </div>
            <div className="cap" style={{ marginBottom: 8 }}>{filtered.length} line(s) · net profit impact {M(sum(filtered.map((r) => r.Impact)), true)} · sorted by size of impact · click a row for commentary</div>
            <div className="grid2">
              <div className="scroll" style={{ maxHeight: 640 }}>
                <table><thead><tr><th></th><th>Segment</th><th>Account</th><th className="n">Actual</th><th className="n">Budget</th><th className="n">Var %</th><th className="n">Profit impact</th></tr></thead>
                  <tbody>{fSorted.map((r) => <tr key={keyOf(r)} className={`click ${selRow && keyOf(selRow) === keyOf(r) ? "sel" : ""}`} onClick={() => setSel(keyOf(r))}>
                    <td>{ragDot(r.RAG)}</td><td>{r.Segment}</td><td>{r.Account}<div style={{ fontSize: 11.5, color: C.muted }}>{r.Type}</div></td><td className="n">{num(r.Actual)}</td><td className="n">{num(r.Budget)}</td><td className="n">{pct(r.VariancePct, true)}</td><td className={`n ${fuCls(r.FU)}`}>{(r.Impact > 0 ? "+" : "") + num(r.Impact)}</td></tr>)}</tbody></table>
              </div>
              <div>{selRow ? (<>
                <div className="card"><h4>{selRow.Segment} · {selRow.Type}</h4><p style={{ fontSize: 17, fontWeight: 600 }}>{selRow.Account}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{chip(fuCls(selRow.FU) || "n", selRow.FU)}{selRow.Material && chip("m", "Material")}{chip("n", selRow.Nature)}</div>
                  <table style={{ marginTop: 10 }}><tbody>
                    <tr><td>Actual</td><td className="n">{M(selRow.Actual)}</td></tr><tr><td>Budget</td><td className="n">{M(selRow.Budget)}</td></tr>
                    <tr><td>Variance</td><td className="n">{M(selRow.Variance, true)} ({pct(selRow.VariancePct, true)})</td></tr>
                    <tr className="b"><td>Profit impact</td><td className={`n ${fuCls(selRow.FU)}`}>{M(selRow.Impact, true)}</td></tr></tbody></table></div>
                <div className="card"><h4>Expert commentary</h4><p>{selRow.Commentary}</p></div>
                <div className="card rec"><h4>Recommended action · Owner: {selRow.Owner}</h4><p>{selRow.Action}</p></div>
                {selRow.Standard && <div className="card"><h4>Accounting reference</h4><p>{selRow.Standard}</p></div>}
                {checks.filter((c) => c.Segment === selRow.Segment && c.Severity !== "Info").map((c, i) => <div className="card" key={i}><h4>Related finding · {c.Severity} · {c.Test}</h4><p>{c.Finding}</p></div>)}
              </>) : <div className="card"><p>No lines match the filters.</p></div>}</div>
            </div>
          </>)}

          {/* 5. Exceptions */}
          {tab === 4 && (<>
            <div className="kpis" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
              <div className="kpi"><div className="l">Material variances</div><div className="v">{rows.filter((r) => r.Material).length} of {rows.length}</div></div>
              <div className="kpi"><div className="l">Material adverse</div><div className="v">{rows.filter((r) => r.Material && r.FU === "Adverse").length}</div>{chip("a", M(sum(rows.filter((r) => r.Material && r.FU === "Adverse").map((r) => r.Impact)), true))}</div>
              <div className="kpi"><div className="l">Material favourable</div><div className="v">{rows.filter((r) => r.Material && r.FU === "Favourable").length}</div>{chip("f", M(sum(rows.filter((r) => r.Material && r.FU === "Favourable").map((r) => r.Impact)), true))}</div>
            </div>
            <div className="panel"><h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Exceptions register<button className={advOnly ? "on" : ""} onClick={() => setAdvOnly(!advOnly)}>{advOnly ? "✓ " : ""}Adverse only</button></h3>
              <div className="scroll" style={{ maxHeight: 620 }}><table><thead><tr><th></th><th>Segment</th><th>Account</th><th className="n">Profit impact</th><th className="n">Var %</th><th>Nature</th><th style={{ minWidth: 320 }}>Required action</th><th>Owner</th></tr></thead>
                <tbody>{exceptions.map((r) => <tr key={keyOf(r)}><td>{ragDot(r.RAG)}</td><td>{r.Segment}</td><td>{r.Account}</td><td className={`n ${fuCls(r.FU)}`}>{M(r.Impact, true)}</td><td className="n">{pct(r.VariancePct, true)}</td><td>{r.Nature}</td><td>{r.Action}</td><td>{r.Owner}</td></tr>)}</tbody></table></div></div>
            <div className="panel"><h3>Accountability summary</h3>
              <table><thead><tr><th>Owner</th><th className="n">Items</th><th className="n">Adverse</th><th className="n">Net profit impact</th></tr></thead>
                <tbody>{Object.entries(exceptions.reduce((a: Record<string, Row[]>, r) => ((a[r.Owner] = a[r.Owner] || []).push(r), a), {})).map(([o, d]) => [o, d, sum(d.map((r) => r.Impact))] as [string, Row[], number]).sort((a, b) => a[2] - b[2]).map(([o, d, v]) =>
                  <tr key={o}><td>{o}</td><td className="n">{d.length}</td><td className="n">{d.filter((r) => r.FU === "Adverse").length}</td><td className={`n ${v >= 0 ? "f" : "a"}`}>{M(v, true)}</td></tr>)}</tbody></table></div>
          </>)}

          {/* 6. Analytical review */}
          {tab === 5 && (<>
            <div className="cap" style={{ marginBottom: 10 }}>Tests relationships a reviewer would expect to hold (commissions move with bookings, hosting with usage, payroll with recruiting). Findings are quantified from the data.</div>
            <div className="filters">{(["High", "Medium", "Info"] as const).map((x) => <button key={x} className={sev.includes(x) ? "on" : ""} onClick={() => setSev(sev.includes(x) ? sev.filter((y) => y !== x) : [...sev, x])}>{x} ({checks.filter((c) => c.Severity === x).length})</button>)}</div>
            {checks.filter((c) => sev.includes(c.Severity)).map((c, i) => (
              <div className="card" key={i} style={{ boxShadow: `inset 3px 0 0 ${c.Severity === "High" ? "#d03b3b" : c.Severity === "Medium" ? "#fab219" : C.fav}` }}>
                <h4>{c.Severity} · {c.Segment} · {c.Test}</h4><p>{c.Finding}</p><p style={{ marginTop: 6 }}><b>Action:</b> {c.Action}</p></div>))}
          </>)}

          {/* 7. Methodology */}
          {tab === 6 && (<>
            <div className="panel"><h3>Data validation</h3>
              <table><thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>{validation.map((v) => <tr key={v.Check}><td>{v.Check}</td><td className={v.Result === "Pass" ? "f" : v.Result === "Warning" ? "a" : ""}>{v.Result}</td><td>{v.Detail}</td></tr>)}</tbody></table>
              <div className="cap">Control totals — Actual {num(sum(rows.map((r) => r.Actual)))} · Budget {num(sum(rows.map((r) => r.Budget)))} · Variance {num(sum(rows.map((r) => r.Variance)))} (gross sum of all lines).</div></div>
            <div className="panel"><h3>Methodology</h3><ul style={{ lineHeight: 1.7, fontSize: 14, margin: 0, paddingLeft: 20 }}>
              <li><b>Variance</b> = Actual − Budget; <b>Var %</b> = Variance ÷ |Budget|.</li>
              <li><b>Profit impact</b> = Variance for revenue lines, −Variance for cost lines. Positive = favourable.</li>
              <li><b>Materiality</b>: |Variance| ≥ {M(s.amt)} <b>{s.rule === "Either" ? "or" : "and"}</b> |Var %| ≥ {Math.round(s.pctThr * 100)}% (the % test applies only where |Variance| ≥ {M(s.floor)}).</li>
              <li><b>RAG</b>: Red = material adverse · Amber = adverse within 50% of a threshold, or material cost underspend to validate · Green = other.</li>
              <li><b>Commentary</b> is generated from an account knowledge base (nature, drivers, action, owner, accounting reference) and analytical cross-checks. It is deterministic: the same data always gives the same commentary.</li>
              <li>Commentary identifies <i>likely</i> drivers and the evidence to obtain. Capture budget-holder explanations before Board submission.</li></ul></div>
          </>)}
        </main>
      </div>

      {/* ---------------------------------------------------------------- print-only Board paper */}
      <div className="print-only">
        <h1>Board Paper: Variance Analysis — {s.period}</h1>
        <p><i>Prepared by the Office of the CFO. Basis: Actual vs Budget. Materiality: {M(s.amt)} or {Math.round(s.pctThr * 100)}% ({s.rule === "Either" ? "either" : "both"} criteria).</i></p>
        <h2>1. Executive summary</h2>{summary.map(([h, p]) => <p key={h}><b>{h}.</b> {p}</p>)}
        <h2>2. Management P&L</h2>
        <table><thead><tr><th>Line</th><th className="n">Actual</th><th className="n">Budget</th><th className="n">Variance</th><th className="n">Var %</th><th>F / A</th></tr></thead>
          <tbody>{pl.map((l) => <tr key={l.Line} style={{ fontWeight: l.bold ? 700 : 400 }}><td>{l.Line}</td><td className="n">{num(l.Actual)}</td><td className="n">{num(l.Budget)}</td><td className="n">{num(l.Variance)}</td><td className="n">{pct(l.VariancePct, true)}</td><td>{l.FU}</td></tr>)}</tbody></table>
        <h2>3. Segment commentary</h2>{segs.map((sg) => <p key={sg}><b>{sg}:</b> {segmentNarrative(rows, sg, checks, s)}</p>)}
        <h2>4. Material adverse variances</h2>
        <table><thead><tr><th>Segment / Account</th><th className="n">Impact</th><th className="n">Var %</th><th>Action required</th><th>Owner</th></tr></thead>
          <tbody>{byImpact(rows.filter((r) => r.Material && r.FU === "Adverse")).map((r) => <tr key={keyOf(r)}><td>{r.Segment} — {r.Account}</td><td className="n">{M(r.Impact, true)}</td><td className="n">{pct(r.VariancePct, true)}</td><td>{r.Action}</td><td>{r.Owner}</td></tr>)}</tbody></table>
        <h2>5. Analytical review findings</h2>{checks.filter((c) => c.Severity !== "Info").map((c, i) => <p key={i}><b>[{c.Severity}] {c.Segment} — {c.Test}:</b> {c.Finding} Action: {c.Action}</p>)}
        <p style={{ marginTop: 12 }}><i>Basis of preparation: Variance = Actual − Budget. Revenue above budget and costs below budget are favourable to operating profit. Commentary is rule-based; management explanations should be obtained from budget holders before the paper is finalised.</i></p>
      </div>
    </>
  );
}
