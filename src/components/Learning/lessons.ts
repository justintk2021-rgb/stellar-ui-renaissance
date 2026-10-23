export interface Lesson {
  id: string;
  category: "Risk" | "Psychology" | "Execution" | "Journal";
  title: string;
  minutes: number;
  summary: string;
  points: string[];
}

export const LESSONS: Lesson[] = [
  {
    id: "size-first",
    category: "Risk",
    title: "Size the trade before you like the setup",
    minutes: 4,
    summary: "The setup can be right and the size can still end the account.",
    points: [
      "Write the stop and the dollar risk before you place the order. If the size only works when you move the stop, skip the trade.",
      "A prop-style daily loss limit is a budget for the session, not a target to spend. Two losses at full size can finish the day.",
      "If you cannot say the risk in one sentence — “I lose $X if this stop is hit” — you do not have a position size yet.",
    ],
  },
  {
    id: "daily-stop",
    category: "Risk",
    title: "The daily stop is a decision you made yesterday",
    minutes: 3,
    summary: "A loss limit only works if you stop trading when it is hit.",
    points: [
      "Pick the limit while you are flat. Changing it after a red trade is the same as not having one.",
      "When the limit is hit, the next job is to close the platform. Reviewing the trades can wait until the next session.",
      "A green day does not raise the limit. The rule is about the worst day, not the average day.",
    ],
  },
  {
    id: "drawdown-budget",
    category: "Risk",
    title: "Drawdown is a budget, not a mood",
    minutes: 4,
    summary: "Static and trailing drawdowns fail in different places. Know which one you are on.",
    points: [
      "Static drawdown is distance from the starting balance. A big winner does not buy you more room.",
      "Trailing drawdown follows the peak. Giving back open profit can breach the account even while you are still up on the challenge.",
      "Log the distance to the limit after the session, the same way you log P&L. The number should not be a surprise.",
    ],
  },
  {
    id: "revenge",
    category: "Psychology",
    title: "The trade after a loss is a different trade",
    minutes: 3,
    summary: "Revenge is a change of plan, not a continuation of the setup.",
    points: [
      "If the next order is larger, faster, or off the checklist, it is not the same strategy. Tag it in the journal so the stats stay honest.",
      "A short break — even one chart timeframe — is enough to separate the loss from the next decision.",
      "The playbook exists for this moment. If the setup is not on the list, there is nothing to click.",
    ],
  },
  {
    id: "one-winner",
    category: "Psychology",
    title: "One winner is not a system",
    minutes: 3,
    summary: "A good day is a sample. The journal is the sample size.",
    points: [
      "Read win rate with breakeven trades included. Dropping the scratches makes a strategy look cleaner than it traded.",
      "Compare a setup across weeks, not across the last three tickets. A setup with five trades is a story.",
      "Write what you would still do if the last trade had lost. If the answer changes, the plan was the P&L.",
    ],
  },
  {
    id: "sessions",
    category: "Execution",
    title: "Trade the session you actually prepared",
    minutes: 4,
    summary: "London, New York, and the overlap are different markets wearing the same symbol.",
    points: [
      "Pick one or two windows and treat the rest of the day as closed. Extra hours are where unplanned trades show up.",
      "Note the session on every ticket. A setup that only works in one window is still a setup — if you stop taking it in the others.",
      "News on the calendar is part of the session, not a separate hobby. If you do not trade through the print, the alarm is the plan.",
    ],
  },
  {
    id: "checklist",
    category: "Execution",
    title: "A checklist is a gate, not a diary",
    minutes: 3,
    summary: "If every box can be checked after you are already in, it is not protecting you.",
    points: [
      "Keep the list short enough to finish before the order: bias, level, trigger, stop, size.",
      "A failed check means no trade. “Mostly checked” is how the off-plan tickets get into the stats.",
      "Review the unchecked item in the notebook. The miss is the lesson, not the P&L of the trade you took anyway.",
    ],
  },
  {
    id: "after-loss",
    category: "Journal",
    title: "What to write after a loss",
    minutes: 4,
    summary: "The useful note is the decision, not the feeling in paragraph form.",
    points: [
      "Four lines are enough: setup name, whether it was on the playbook, where the stop was, and whether you moved it.",
      "Screenshot the entry, not the aftermath. The chart after the stop is a different story than the one you traded.",
      "Skip the essay on days you followed the plan. Those losses are the cost of the system. The notes that matter are the ones where you didn’t.",
    ],
  },
  {
    id: "weekly-review",
    category: "Journal",
    title: "Review the week, not the last tick",
    minutes: 4,
    summary: "A weekly pass catches the leak that a single ticket hides.",
    points: [
      "Sort the week by setup, then by whether the checklist was complete. P&L comes third.",
      "Count the trades taken outside your session. That number is usually the whole problem.",
      "Change one rule for the next week. A review that adds five new rules will not survive Monday.",
    ],
  },
  {
    id: "one-sentence",
    category: "Journal",
    title: "Name the setup in one sentence",
    minutes: 3,
    summary: "If the playbook entry needs a paragraph, you will not use it live.",
    points: [
      "One sentence: market, level, trigger, invalidation. Example: “Long the London low after a sweep and a close back inside, stop beyond the sweep.”",
      "If two setups share that sentence, they are one setup. Split them only when the stop or the session is different.",
      "Retire a setup in writing when you stop taking it. Leaving it in the playbook makes every impulse look planned.",
    ],
  },
];

export const LESSON_CATEGORIES = ["All", "Risk", "Psychology", "Execution", "Journal"] as const;
