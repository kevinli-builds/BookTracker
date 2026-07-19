import { describe, expect, it } from 'vitest';

import { AnalysisBundleData } from '../../api/client';
import { buildAnalysisBundleFiles, questionColumn } from '../analysisBundle';

const identity = (n: number) => ({
  displayName: n === 1 ? 'Alice' : '=cmd|evil', // participant 2 probes formula injection
  studyGroup: n === 1 ? 'tracking' : 'control',
  inviteCode: { code: `CODE${n}`, label: `P${n}` },
});

const fixture: AnalysisBundleData = {
  exportedAt: '2026-07-18T12:00:00.000Z',
  users: [1, 2].map(n => ({
    id: `user-${n}`,
    displayName: identity(n).displayName,
    status: n === 1 ? 'active' : 'withdrawn',
    studyGroup: identity(n).studyGroup,
    createdAt: '2026-06-01T00:00:00.000Z',
    streak: n === 1 ? { currentStreak: 3, longestStreak: 5, lastReadDate: '2026-07-17' } : null,
    inviteCode: identity(n).inviteCode,
    _count: { logs: n === 1 ? 2 : 0, userGoals: 1 },
  })),
  logs: [
    {
      id: 'log-1', userId: 'user-1', user: identity(1),
      googleBooksId: 'OL1', title: 'Dune', author: 'Frank Herbert',
      categories: ['Science Fiction', 'Classics'], pageCount: 412,
      minutesRead: 30, loggedAt: '2026-07-01T20:00:00.000Z',
    },
    {
      // pre-categories-era log: empty categories, no pageCount
      id: 'log-2', userId: 'user-1', user: identity(1),
      googleBooksId: 'OL2', title: 'Old Log', author: 'Anon',
      categories: [], pageCount: null,
      minutesRead: 15, loggedAt: '2026-06-15T09:00:00.000Z',
    },
  ],
  userGoals: [
    {
      id: 'ug-1', userId: 'user-1', user: identity(1),
      template: { id: 'gt-1', title: 'Read 3 books', description: '', type: 'books_count', criteria: { count: 3 }, randomPool: true, createdAt: '2026-06-01T00:00:00.000Z' },
      status: 'active', assignedBy: 'system',
      assignedAt: '2026-06-10T00:00:00.000Z', completedAt: null, deadline: null,
      progress: '1 / 3 books', met: false, autoCheckable: true,
    },
    {
      // abandoned + custom: must appear, criteria_met must be n/a
      id: 'ug-2', userId: 'user-2', user: identity(2),
      template: { id: 'gt-2', title: 'My own goal', description: '', type: 'custom', criteria: {}, randomPool: false, createdAt: '2026-06-01T00:00:00.000Z' },
      status: 'abandoned', assignedBy: 'self',
      assignedAt: '2026-06-12T00:00:00.000Z', completedAt: null, deadline: '2026-07-01T00:00:00.000Z',
      progress: 'n/a', met: false, autoCheckable: false,
    },
  ],
  goalTemplates: [
    { id: 'gt-1', title: 'Read 3 books', description: 'desc', type: 'books_count', criteria: { count: 3 }, randomPool: true, createdAt: '2026-06-01T00:00:00.000Z', _count: { userGoals: 1 } },
  ],
  feedback: [
    {
      id: 'fb-1', userId: 'user-1', user: identity(1), userGoalId: 'ug-1',
      userGoal: { template: { title: 'Read 3 books' } },
      rating: 4, text: 'liked it', createdAt: '2026-07-02T00:00:00.000Z',
    },
  ],
  surveyConfig: { cadenceDays: 7 },
  surveyQuestions: [
    { id: 'q-a', prompt: 'How many minutes did you read this week?', type: 'number', sortOrder: 1, required: true, active: true },
    { id: 'q-b', prompt: 'Rate your week', type: 'rating', sortOrder: 2, required: false, active: false },
  ],
  surveyResponses: [
    {
      id: 'resp-1', userId: 'user-2', user: identity(2),
      answers: { 'q-a': 120 }, // q-b unanswered → no long row, blank wide cell
      submittedAt: '2026-07-10T00:00:00.000Z',
    },
  ],
  studyConfig: { hideTrackingGroups: ['control'] },
};

const files = buildAnalysisBundleFiles(fixture);
const byName = Object.fromEntries(files.map(f => [f.name, f.content]));

describe('buildAnalysisBundleFiles', () => {
  it('produces every bundle file', () => {
    expect(files.map(f => f.name).sort()).toEqual([
      'codebook.md',
      'feedback.csv',
      'goal_templates.csv',
      'goals.csv',
      'participants.csv',
      'reading_logs.csv',
      'study_config.json',
      'survey_questions.csv',
      'survey_responses_long.csv',
      'survey_responses_wide.csv',
    ]);
  });

  it('participants.csv has one row per participant with streaks and counts', () => {
    const lines = byName['participants.csv'].split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('user_id,invite_code,participant_label,display_name,study_group,status,joined_at,current_streak,longest_streak,last_read_date,total_logs,total_goals');
    expect(lines[1]).toContain('user-1,CODE1,P1,Alice,tracking,active');
    expect(lines[1]).toContain(',3,5,2026-07-17,2,1');
    expect(lines[2]).toContain('withdrawn');
    expect(lines[2]).toContain(',0,0,,0,1'); // streakless participant → zeros
  });

  it('neutralizes formula injection in participant-entered text', () => {
    expect(byName['participants.csv']).toContain("'=cmd|evil");
  });

  it('reading_logs.csv pipe-joins categories and leaves pre-feature logs blank', () => {
    const lines = byName['reading_logs.csv'].split('\n');
    expect(lines[1]).toContain('Science Fiction|Classics');
    expect(lines[1]).toContain('412');
    expect(lines[2]).toContain(',,'); // empty categories + page_count
  });

  it('goals.csv includes abandoned goals and marks custom as n/a', () => {
    const csv = byName['goals.csv'];
    expect(csv).toContain('abandoned');
    const custom = csv.split('\n').find(l => l.includes('ug-2'))!;
    expect(custom).toContain('n/a');
    const auto = csv.split('\n').find(l => l.includes('ug-1'))!;
    expect(auto).toContain(',no'); // autoCheckable, not met
    expect(auto).toContain('"{""count"":3}"'); // criteria JSON survives escaping
  });

  it('long responses have one row per ANSWERED question only', () => {
    const lines = byName['survey_responses_long.csv'].split('\n');
    expect(lines).toHaveLength(2); // header + the single q-a answer
    expect(lines[1]).toContain('q-a');
    expect(lines[1]).toContain('120');
  });

  it('wide responses carry a column per question, blank when unanswered', () => {
    const [header, row] = byName['survey_responses_wide.csv'].split('\n');
    const qa = questionColumn(fixture.surveyQuestions[0]);
    const qb = questionColumn(fixture.surveyQuestions[1]);
    expect(header).toContain(qa);
    expect(header).toContain(qb); // inactive question still gets a column
    const cells = row.split(',');
    expect(cells[header.split(',').indexOf(qa)]).toBe('120');
    expect(cells[header.split(',').indexOf(qb)]).toBe('');
  });

  it('empty tables still produce a header row', () => {
    const empty = buildAnalysisBundleFiles({ ...fixture, feedback: [] });
    const fb = empty.find(f => f.name === 'feedback.csv')!.content;
    expect(fb).toBe('feedback_id,user_id,invite_code,participant_label,display_name,study_group,user_goal_id,goal_title,rating,comment,created_at');
  });

  it('study_config.json snapshot parses and carries the study settings', () => {
    const cfg = JSON.parse(byName['study_config.json']);
    expect(cfg.checkInCadenceDays).toBe(7);
    expect(cfg.hideTrackingGroups).toEqual(['control']);
    expect(cfg.counts.participants).toBe(2);
    expect(cfg.surveyQuestions).toHaveLength(2);
  });

  it('codebook documents every file and the load-bearing coding decisions', () => {
    const cb = byName['codebook.md'];
    for (const f of files) {
      if (f.name !== 'codebook.md') expect(cb).toContain(f.name);
    }
    expect(cb).toContain('LOCAL calendar date'); // streak vs UTC caveat
    expect(cb).toContain('after the categories feature shipped');
    expect(cb).toContain('auto-complete');
    expect(cb).toContain('every 7 days');
    expect(cb).toContain('control'); // hidden group named
  });

  it('questionColumn builds stable readable names', () => {
    expect(questionColumn({ sortOrder: 1, prompt: 'How many minutes did you read this week?' })).toBe('q1_how_many_minutes_did_you_read');
    expect(questionColumn({ sortOrder: 3, prompt: '???' })).toBe('q3');
  });
});
