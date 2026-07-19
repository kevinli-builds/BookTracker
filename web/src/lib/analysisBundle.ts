// Turns the /admin/bundle payload into the files of the one-click analysis
// bundle: tidy CSVs, a codebook documenting every column and coding decision,
// and a study-config snapshot. Pure functions — the caller zips and downloads.
import { AnalysisBundleData, BundleIdentity, SurveyQuestion } from '../api/client';
import { buildCsv } from './csv';

export interface BundleFile {
  name: string;
  content: string;
}

// Shared participant-identity columns prefixed onto every per-row table so any
// CSV can be analyzed standalone or joined on user_id.
function identity(user: BundleIdentity | null, userId: string) {
  return {
    user_id: userId,
    invite_code: user?.inviteCode?.code ?? '',
    participant_label: user?.inviteCode?.label ?? '',
    display_name: user?.displayName ?? '',
    study_group: user?.studyGroup ?? '',
  };
}

// Stable, readable wide-format column name for a survey question. Long
// prompts truncate at a word boundary so no column ends in a fragment.
export function questionColumn(q: Pick<SurveyQuestion, 'sortOrder' | 'prompt'>): string {
  const full = q.prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  let slug = full.slice(0, 32);
  if (full.length > 32 && slug.includes('_')) slug = slug.replace(/_[^_]*$/, '');
  return `q${q.sortOrder}${slug ? `_${slug}` : ''}`;
}

export function buildAnalysisBundleFiles(b: AnalysisBundleData): BundleFile[] {
  const participants = b.users.map(u => ({
    ...identity({ displayName: u.displayName, studyGroup: u.studyGroup, inviteCode: u.inviteCode }, u.id),
    status: u.status,
    joined_at: u.createdAt,
    current_streak: u.streak?.currentStreak ?? 0,
    longest_streak: u.streak?.longestStreak ?? 0,
    last_read_date: u.streak?.lastReadDate ?? '',
    total_logs: u._count.logs,
    total_goals: u._count.userGoals,
  }));

  const readingLogs = b.logs.map(l => ({
    log_id: l.id,
    ...identity(l.user, l.userId),
    google_books_id: l.googleBooksId,
    title: l.title,
    author: l.author,
    categories: (l.categories ?? []).join('|'),
    page_count: l.pageCount ?? '',
    minutes_read: l.minutesRead,
    logged_at: l.loggedAt,
  }));

  const goals = b.userGoals.map(g => ({
    user_goal_id: g.id,
    ...identity(g.user, g.userId),
    goal_template_id: g.template.id,
    goal_title: g.template.title,
    goal_type: g.template.type,
    criteria: JSON.stringify(g.template.criteria ?? {}),
    assigned_by: g.assignedBy,
    status: g.status,
    assigned_at: g.assignedAt,
    deadline: g.deadline ?? '',
    completed_at: g.completedAt ?? '',
    progress: g.progress,
    criteria_met: g.autoCheckable ? (g.met ? 'yes' : 'no') : 'n/a',
  }));

  const goalTemplates = b.goalTemplates.map(t => ({
    goal_template_id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    criteria: JSON.stringify(t.criteria ?? {}),
    random_pool: t.randomPool ? 'yes' : 'no',
    created_at: t.createdAt,
    times_assigned: t._count.userGoals,
  }));

  const feedback = b.feedback.map(f => ({
    feedback_id: f.id,
    ...identity(f.user, f.userId),
    user_goal_id: f.userGoalId,
    goal_title: f.userGoal.template.title,
    rating: f.rating ?? '',
    comment: f.text ?? '',
    created_at: f.createdAt,
  }));

  const surveyQuestions = b.surveyQuestions.map(q => ({
    question_id: q.id,
    wide_column: questionColumn(q),
    prompt: q.prompt,
    type: q.type,
    sort_order: q.sortOrder,
    required: q.required ? 'yes' : 'no',
    active: q.active ? 'yes' : 'no',
  }));

  const questionById = new Map(b.surveyQuestions.map(q => [q.id, q]));

  // Long (tidy) format: one row per answered question.
  const responsesLong = b.surveyResponses.flatMap(r =>
    Object.entries(r.answers).map(([questionId, answer]) => ({
      response_id: r.id,
      ...identity(r.user, r.userId),
      submitted_at: r.submittedAt,
      question_id: questionId,
      question_prompt: questionById.get(questionId)?.prompt ?? '(question deleted)',
      answer,
    }))
  );

  // Wide format: one row per check-in, one column per question (incl. inactive
  // ones — historical responses may reference them).
  const responsesWide = b.surveyResponses.map(r => {
    const row: Record<string, unknown> = {
      response_id: r.id,
      ...identity(r.user, r.userId),
      submitted_at: r.submittedAt,
    };
    for (const q of b.surveyQuestions) row[questionColumn(q)] = r.answers[q.id] ?? '';
    return row;
  });
  const wideHeaders = [
    'response_id', 'user_id', 'invite_code', 'participant_label', 'display_name', 'study_group',
    'submitted_at', ...b.surveyQuestions.map(questionColumn),
  ];

  const configSnapshot = {
    exportedAt: b.exportedAt,
    checkInCadenceDays: b.surveyConfig?.cadenceDays ?? null,
    hideTrackingGroups: b.studyConfig?.hideTrackingGroups ?? [],
    surveyQuestions: b.surveyQuestions,
    goalTemplates: b.goalTemplates,
    counts: {
      participants: b.users.length,
      readingLogs: b.logs.length,
      userGoals: b.userGoals.length,
      feedback: b.feedback.length,
      surveyResponses: b.surveyResponses.length,
    },
  };

  const idCols = (unit: string) => `- \`user_id\` — the participant's anonymous device UUID (primary key for joins)
- \`invite_code\` / \`participant_label\` — the invite code ${unit} redeemed and the researcher-assigned label baked into it; the code→person master list lives outside the app
- \`display_name\` — self-entered name (may be blank; not verified)
- \`study_group\` — experimental condition at export time (assigned by the researcher; free-form name)`;

  const codebook = `# BookTracker analysis bundle — codebook

Exported: ${b.exportedAt}
Check-in cadence: every ${b.surveyConfig?.cadenceDays ?? '?'} days
Groups with tracking hidden (check-in-only app): ${
    (b.studyConfig?.hideTrackingGroups ?? []).length > 0
      ? (b.studyConfig?.hideTrackingGroups ?? []).join(', ')
      : '(none)'
  }
Rows: ${b.users.length} participants · ${b.logs.length} reading logs · ${b.userGoals.length} goal assignments · ${b.surveyResponses.length} check-ins · ${b.feedback.length} feedback entries

All timestamps are ISO-8601 UTC unless noted. Cells beginning with \`'=\`, \`'+\`,
\`'-\` or \`'@\` were prefixed with an apostrophe to neutralize spreadsheet formula
injection — strip the leading apostrophe if you parse them programmatically.
Participants are anonymous: identity is a device UUID plus an invite code whose
code→person mapping is held by the researcher outside the app.

## participants.csv
One row per enrolled participant.
${idCols('this participant')}
- \`status\` — \`active\` or \`withdrawn\` (withdrawn participants stop appearing in the app but their collected data is retained unless separately deleted)
- \`joined_at\` — when the device user was first created (before invite redemption is possible in principle, so this is at-or-before enrollment)
- \`current_streak\` / \`longest_streak\` — consecutive-day reading streaks. **Streaks key off the participant's LOCAL calendar date** (the app sends its local date with each log), so they can disagree with UTC \`logged_at\` dates around midnight
- \`last_read_date\` — the local date of the last streak-counted log
- \`total_logs\` / \`total_goals\` — row counts at export time (should match the other files)

## reading_logs.csv
One row per logged book/reading session (the tracking groups' behavioral record).
${idCols('the logger')}
- \`log_id\` — unique log id
- \`google_books_id\` — the catalog id of the logged book (Open Library or Google Books, depending on server config)
- \`title\` / \`author\` — as returned by the book search at logging time
- \`categories\` — pipe-separated genre/category strings from the book catalog. **Only populated for logs created after the categories feature shipped** — older logs have it empty, and genre-goal auto-checks only count logs that carry categories
- \`page_count\` — book page count from the catalog. Same caveat: **empty for logs predating the page-count feature**; pages-goal checks sum distinct books' page counts
- \`minutes_read\` — participant-entered minutes for this session (self-report)
- \`logged_at\` — server receipt time (UTC). The streak calculation does NOT use this — see participants.csv

## goals.csv
One row per goal assignment (participant × goal template), **all statuses
including abandoned**.
${idCols('the assignee')}
- \`user_goal_id\` — unique assignment id
- \`goal_template_id\` / \`goal_title\` / \`goal_type\` / \`criteria\` — the assigned template (see goal_templates.csv). \`criteria\` is the JSON the auto-checker evaluates: \`books_count\` {count}, \`pages\` {pages}, \`minutes\` {minutes}, \`author\` {author}, \`genre\` {genre}, \`specific_book\` {googleBooksId, title}, \`custom\` {}
- \`assigned_by\` — \`self\` (participant picked it) vs \`system\` (randomly assigned from the pool by the researcher)
- \`status\` — \`active\` / \`completed\` / \`abandoned\` (participant-visible status). **Non-custom goals auto-complete** server-side the moment logging satisfies their criteria; \`custom\` goals are completed manually by the participant
- \`assigned_at\` / \`deadline\` / \`completed_at\` — assignment lifecycle timestamps
- \`progress\` — human-readable progress at export time, computed from logs recorded AFTER \`assigned_at\`
- \`criteria_met\` — \`yes\`/\`no\` auto-check result at export time, or \`n/a\` where the stored data can't verify it (\`custom\` always; \`genre\` for logs without categories). Compare with \`status\` to find met-but-unmarked or completed-without-verification cases

## goal_templates.csv
One row per goal template the researcher built (assigned or not).
- \`random_pool\` — whether the template participates in random assignment
- \`times_assigned\` — how many participants hold/held it

## feedback.csv
One row per feedback entry a participant left on a completed goal.
${idCols('the author')}
- \`rating\` — 1–5 stars (may be empty if only a comment was left)
- \`comment\` — free text (may be empty)

## survey_questions.csv
The check-in questionnaire at export time, including inactive (removed)
questions — historical responses may reference them.
- \`wide_column\` — the column name this question maps to in survey_responses_wide.csv
- \`type\` — \`number\` / \`rating\` (1–5) / \`text\`
- \`required\` / \`active\` — question settings at export time. **Question prompts are editable mid-study**: the prompt shown here is the CURRENT text, which past responses answered in whatever wording was live at their submission

## survey_responses_long.csv (tidy)
One row per (check-in × answered question) — the shared outcome measure across
conditions. Unanswered optional questions produce NO row here.
- \`response_id\` — groups rows belonging to one check-in submission
- \`question_id\` / \`question_prompt\` — joins survey_questions.csv (\`(question deleted)\` marks answers to since-deleted questions)
- \`answer\` — number, 1–5 rating, or free text depending on question type
- \`submitted_at\` — submission time (UTC). Check-ins are immutable once submitted

## survey_responses_wide.csv
One row per check-in, one column per question (blank = unanswered). Column
names are in survey_questions.csv \`wide_column\`.

## study_config.json
Machine-readable snapshot of the study configuration at export time: cadence,
hidden-tracking groups, full question set, full goal templates, table counts.
`;

  return [
    { name: 'participants.csv', content: buildCsv(participants, ['user_id', 'invite_code', 'participant_label', 'display_name', 'study_group', 'status', 'joined_at', 'current_streak', 'longest_streak', 'last_read_date', 'total_logs', 'total_goals']) },
    { name: 'reading_logs.csv', content: buildCsv(readingLogs, ['log_id', 'user_id', 'invite_code', 'participant_label', 'display_name', 'study_group', 'google_books_id', 'title', 'author', 'categories', 'page_count', 'minutes_read', 'logged_at']) },
    { name: 'goals.csv', content: buildCsv(goals, ['user_goal_id', 'user_id', 'invite_code', 'participant_label', 'display_name', 'study_group', 'goal_template_id', 'goal_title', 'goal_type', 'criteria', 'assigned_by', 'status', 'assigned_at', 'deadline', 'completed_at', 'progress', 'criteria_met']) },
    { name: 'goal_templates.csv', content: buildCsv(goalTemplates, ['goal_template_id', 'title', 'description', 'type', 'criteria', 'random_pool', 'created_at', 'times_assigned']) },
    { name: 'feedback.csv', content: buildCsv(feedback, ['feedback_id', 'user_id', 'invite_code', 'participant_label', 'display_name', 'study_group', 'user_goal_id', 'goal_title', 'rating', 'comment', 'created_at']) },
    { name: 'survey_questions.csv', content: buildCsv(surveyQuestions, ['question_id', 'wide_column', 'prompt', 'type', 'sort_order', 'required', 'active']) },
    { name: 'survey_responses_long.csv', content: buildCsv(responsesLong, ['response_id', 'user_id', 'invite_code', 'participant_label', 'display_name', 'study_group', 'submitted_at', 'question_id', 'question_prompt', 'answer']) },
    { name: 'survey_responses_wide.csv', content: buildCsv(responsesWide, wideHeaders) },
    { name: 'study_config.json', content: JSON.stringify(configSnapshot, null, 2) },
    { name: 'codebook.md', content: codebook },
  ];
}
