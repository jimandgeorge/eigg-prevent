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

# Controls library — a starter control narrative per requirement so a new customer
# isn't writing from a blank page. Offered on the requirement detail ("Use template");
# never auto-applied. [bracketed] parts prompt the customer to complete the detail.
CONTROL_TEMPLATES = {
    "RA-1": "A written fraud risk assessment covering the failure-to-prevent-fraud offence is maintained by [owner], formally approved by the board, version-controlled and reviewed at least annually.",
    "RA-2": "The risk assessment enumerates the specific fraud scenarios the organisation could commit or benefit from and maps each to the categories of associated person (employees, agents, subsidiaries, suppliers) who could perpetrate it.",
    "RA-3": "Each identified fraud risk is scored for likelihood and impact using a defined methodology, with documented rationale and a residual-risk view after controls.",
    "RA-4": "The risk assessment is reviewed on an [annual] cadence and re-run on material change (new products, M&A, regulatory change), with completed reviews logged and dated.",
    "RA-5": "Threat intelligence and regulatory/industry typologies (e.g. UK Finance, FCA alerts) are monitored by [owner] and findings are fed into the risk register.",
    "CT-1": "A board-approved anti-fraud policy proportionate to the assessed risk is published and accessible to all staff, owned by [owner] and acknowledged at onboarding.",
    "CT-2": "Preventive controls (segregation of duties, approval limits, dual authorisation, payment verification) are mapped to each material risk in a controls matrix maintained by [owner].",
    "CT-3": "Detective controls — transaction monitoring, reconciliation, exception reporting and analytics — operate to identify fraud that prevention misses, with exceptions reviewed by [owner].",
    "CT-4": "A confidential whistleblowing/speak-up channel with anti-retaliation protection is available to all staff and associated persons and is actively communicated.",
    "CT-5": "A documented fraud response plan defines how suspected fraud is investigated, escalated, reported (including external reporting triggers) and remediated, with named roles.",
    "CT-6": "Anti-fraud obligations extend to agents and outsourced functions through standard contractual clauses and active oversight of the controls they operate on our behalf.",
    "BG-1": "The board has formally endorsed a stance against fraud and fosters an anti-fraud culture, evidenced by a minuted statement reaffirmed [annually].",
    "BG-2": "A named senior individual ([owner]) owns the fraud prevention framework, with the mandate documented in their role profile / terms of reference.",
    "BG-3": "The board receives fraud risk management information at least [quarterly] and its consideration is minuted.",
    "BG-4": "The framework's effectiveness is independently assured (internal audit / assurance) on a defined cycle, with improvement actions tracked to closure.",
    "BG-5": "Adequate budget, headcount and tooling are allocated to fraud prevention and reviewed as part of annual planning.",
    "DD-1": "Risk-based due diligence is applied to associated persons proportionate to their fraud risk, per a documented procedure tiered by counterparty type.",
    "DD-2": "Pre-engagement background / vetting checks are performed to a defined standard for roles with fraud exposure before the person is engaged.",
    "DD-3": "Third parties and suppliers are onboarded with anti-fraud due diligence and standard anti-fraud contractual terms.",
    "DD-4": "Due diligence on associated persons is refreshed on a risk-based cadence through the relationship, with re-screening logged.",
    "TR-1": "All staff complete proportionate fraud prevention training, with the curriculum and covered population maintained by [owner].",
    "TR-2": "Higher-risk roles receive targeted enhanced fraud training mapped to their specific exposure.",
    "TR-3": "The anti-fraud policy and speak-up channel are actively communicated and accessible, with acknowledgements captured.",
    "TR-4": "Training completion is tracked and overdue completion is followed up, with reporting to [owner].",
    "TR-5": "Training is refreshed on an [annual] cadence and after material change, with last and next due dates tracked.",
}

# Cross-pillar dependencies — requirements that reinforce each other across pillars.
# Strengthening one also lifts the linked requirement's pillar. (code_a, code_b, reason)
CROSS_PILLAR_LINKS = [
    ("CT-6", "DD-3", "Both address third parties acting on the firm's behalf."),
    ("CT-1", "TR-3", "A policy only works if it is actively communicated."),
    ("RA-4", "BG-4", "Risk-assessment review feeds framework monitoring and review."),
    ("BG-1", "CT-1", "Top-level commitment underpins the anti-fraud policy."),
    ("DD-2", "TR-2", "High-risk roles need both pre-engagement screening and enhanced training."),
    ("RA-2", "DD-1", "Same population — the associated persons who could offend."),
    ("CT-3", "BG-3", "Monitoring output is the board's fraud risk MI."),
    ("TR-4", "BG-3", "Training completion is reported as board MI."),
]


def related_codes(code: str) -> list[tuple[str, str]]:
    """Return [(other_code, reason), ...] linked to the given requirement code."""
    out = []
    for a, b, reason in CROSS_PILLAR_LINKS:
        if a == code:
            out.append((b, reason))
        elif b == code:
            out.append((a, reason))
    return out
