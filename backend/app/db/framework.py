"""The EIGG Prevent framework definition.

Five pillars mapped to the Home Office *Guidance to organisations on the offence of
failure to prevent fraud* six principles. This is reference data — seeded into the
`pillars` and `requirements` tables and treated as the spine of the product.
"""

# (id, name, principle, weight, description)
PILLARS = [
    (
        "risk_assessment",
        "Risk assessment",
        "Principle 2 — Risk assessment",
        1.2,
        "Identify and document where the organisation is exposed to fraud committed by "
        "associated persons intending to benefit it.",
    ),
    (
        "controls",
        "Controls",
        "Principle 3 — Proportionate risk-based prevention procedures",
        1.2,
        "Proportionate preventive and detective controls that address the risks "
        "identified in the assessment.",
    ),
    (
        "board_governance",
        "Board governance",
        "Principles 1 & 6 — Top-level commitment + Monitoring & review",
        1.0,
        "Senior commitment, clear ownership, oversight and ongoing review of the fraud "
        "prevention framework.",
    ),
    (
        "due_diligence",
        "Due diligence",
        "Principle 4 — Due diligence",
        1.0,
        "Risk-based checks on the associated persons who could expose the organisation "
        "to the offence.",
    ),
    (
        "training",
        "Training",
        "Principle 5 — Communication (including training)",
        1.0,
        "Communicate the anti-fraud stance and equip staff and associated persons to "
        "prevent fraud.",
    ),
]

# pillar_id -> list of (code, title, description, guidance)
REQUIREMENTS = {
    "risk_assessment": [
        ("RA-1", "Documented fraud risk assessment",
         "A written, board-approved fraud risk assessment exists covering the failure-to-prevent-fraud offence.",
         "Evidence: a dated risk assessment document with version control and sign-off."),
        ("RA-2", "Fraud types and associated persons identified",
         "The assessment identifies the specific frauds the organisation could commit or benefit from, and who its associated persons are (employees, agents, subsidiaries, suppliers).",
         "Evidence: a risk register listing fraud scenarios mapped to categories of associated person."),
        ("RA-3", "Likelihood and impact rated",
         "Each identified fraud risk is rated for likelihood and impact with documented rationale.",
         "Evidence: scored risk register with a clear methodology and residual-risk view."),
        ("RA-4", "Periodic and event-driven review",
         "The risk assessment is reviewed on a defined cadence and whenever there is material change (new products, M&A, regulation).",
         "Evidence: review schedule and a log of completed reviews with dates."),
        ("RA-5", "Emerging-risk horizon scanning",
         "Threat intelligence, regulatory updates and industry typologies feed into the assessment.",
         "Evidence: sources subscribed to and notes showing how findings updated the register."),
    ],
    "controls": [
        ("CT-1", "Anti-fraud policy",
         "A clear, accessible anti-fraud policy proportionate to the assessed risk.",
         "Evidence: the policy document, its owner, and where staff can find it."),
        ("CT-2", "Preventive controls mapped to risks",
         "Specific preventive controls exist for each material risk (segregation of duties, approval limits, payment verification).",
         "Evidence: a controls matrix linking each material risk to one or more controls."),
        ("CT-3", "Detective controls and monitoring",
         "Monitoring, reconciliation, exception reporting and analytics detect fraud that prevention misses.",
         "Evidence: descriptions of monitoring in place and sample exception reports."),
        ("CT-4", "Whistleblowing / speak-up channel",
         "A confidential reporting route exists with anti-retaliation protection.",
         "Evidence: the channel, how it is communicated, and a (anonymised) handling record."),
        ("CT-5", "Fraud response plan",
         "A defined process to investigate, escalate, report and remediate suspected fraud.",
         "Evidence: the response plan with roles, escalation paths and external reporting triggers."),
        ("CT-6", "Controls extend to third parties",
         "Controls reach agents and outsourced functions acting on the organisation's behalf.",
         "Evidence: contractual anti-fraud clauses and oversight of outsourced controls."),
    ],
    "board_governance": [
        ("BG-1", "Top-level commitment",
         "The board / senior management have formally endorsed a stance against fraud and foster an anti-fraud culture.",
         "Evidence: a board-approved statement and minuted endorsement."),
        ("BG-2", "Clear ownership and accountability",
         "A named senior individual owns the fraud prevention framework.",
         "Evidence: a role mandate / terms of reference naming the accountable executive (e.g. SMF/MLRO)."),
        ("BG-3", "Board oversight and management information",
         "The board receives regular fraud risk MI and minutes its consideration.",
         "Evidence: board pack extracts and minutes showing fraud risk on the agenda."),
        ("BG-4", "Monitoring and review of the framework",
         "The effectiveness of the framework is monitored and periodically reviewed and improved.",
         "Evidence: an assurance / internal audit report and a tracked improvement actions log."),
        ("BG-5", "Adequate resourcing",
         "Sufficient budget and resource are allocated to fraud prevention.",
         "Evidence: budget lines, headcount, and tooling assigned to the framework."),
    ],
    "due_diligence": [
        ("DD-1", "Risk-based due diligence on associated persons",
         "Proportionate due diligence is applied to associated persons according to fraud risk.",
         "Evidence: a due-diligence procedure tiered by risk and category of associated person."),
        ("DD-2", "Pre-engagement screening",
         "Background and vetting checks are performed for roles with fraud exposure before engagement.",
         "Evidence: screening standards by role and a sample of completed checks."),
        ("DD-3", "Third-party / supplier due diligence",
         "Onboarding checks and anti-fraud contractual terms apply to third parties and suppliers.",
         "Evidence: onboarding checklist and standard anti-fraud clauses."),
        ("DD-4", "Ongoing monitoring and re-screening",
         "Due diligence is refreshed on a risk basis throughout the relationship.",
         "Evidence: re-screening cadence and a log of refreshed checks."),
    ],
    "training": [
        ("TR-1", "Fraud awareness training programme",
         "All staff receive proportionate fraud prevention training.",
         "Evidence: the training curriculum and population covered."),
        ("TR-2", "Role-specific enhanced training",
         "Higher-risk roles receive targeted, deeper training.",
         "Evidence: enhanced modules and the roles they target."),
        ("TR-3", "Active communication of policies",
         "The anti-fraud policy and speak-up channel are actively communicated and accessible.",
         "Evidence: comms campaigns, intranet placement, acknowledgements."),
        ("TR-4", "Training records and completion tracking",
         "Completion is tracked with follow-up for non-completion.",
         "Evidence: completion reports and overdue follow-up records."),
        ("TR-5", "Refresher cadence",
         "Training is refreshed periodically and after material change.",
         "Evidence: refresher schedule and last/next due dates."),
    ],
}

# Maturity status -> readiness contribution (0-100).
STATUS_SCORE = {
    "not_started": 0,
    "in_progress": 40,
    "implemented": 75,
    "embedded": 100,
}
STATUS_LABELS = {
    "not_started": "Not started",
    "in_progress": "In progress",
    "implemented": "Implemented",
    "embedded": "Embedded",
}
