export interface StageReplayGoalInput {
  stageId: string;
  boss: boolean; // a boss arena (the level def has a boss or a team boss)
  cobs: number;
  totalCobs: number;
  flawless: boolean;
  newBest: boolean;
}

export interface StageReplayGoal {
  id: 'cobs' | 'clean' | 'route' | 'best';
  label: string;
  achieved: boolean;
}

const ROUTE_CHALLENGES: Record<string, string> = {
  '1': 'take the high corn trail',
  '2': 'poke the root switch',
  '3': 'ride the berry lift',
  '4': 'cross the slick boards',
  '5': 'bank a peel shot',
  last: 'chain two crew shortcuts',
  boss: 'answer every recovery',
};

// Every boss fight shares the boss goal; fields key by world digit ('1-boss' is King Corn, not a field).
function routeChallenge(stageId: string, boss: boolean): string {
  if (boss) return ROUTE_CHALLENGES.boss;
  if (stageId.startsWith('end-furrow')) return ROUTE_CHALLENGES.last;
  return ROUTE_CHALLENGES[stageId.charAt(0)] ?? 'find a fresh route';
}

// Presentation-only goals derived from the frozen deterministic result. They never grant currency
// or alter progress: each line is either a celebration or a friendly idea for another run.
export function stageReplayGoals(input: StageReplayGoalInput): StageReplayGoal[] {
  const allCobs = input.totalCobs > 0 && input.cobs >= input.totalCobs;
  const goals: StageReplayGoal[] = [];
  if (input.totalCobs > 0) {
    goals.push({
      id: 'cobs',
      label: allCobs ? `All ${input.totalCobs} cobs` : `Find all ${input.totalCobs} cobs`,
      achieved: allCobs,
    });
  }
  goals.push(
    {
      id: 'clean',
      // "Clean run" read as "no hits" to kids who took hits; the goal is no tries lost (kid-session 3).
      label: input.flawless ? 'Kept every try' : 'Keep every try',
      achieved: input.flawless,
    },
    {
      id: 'route',
      label: `Route challenge: ${routeChallenge(input.stageId, input.boss)}`,
      achieved: false,
    },
    {
      id: 'best',
      label: input.newBest ? 'Personal best' : 'Chase your best',
      achieved: input.newBest,
    },
  );
  return goals;
}
