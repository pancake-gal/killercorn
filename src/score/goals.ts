export interface StageReplayGoalInput {
  stageId: string;
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
  grab: 'answer every recovery',
  final: 'answer every recovery',
};

function routeChallenge(stageId: string): string {
  if (stageId.startsWith('end-final')) return ROUTE_CHALLENGES.final;
  if (stageId.startsWith('end-grab')) return ROUTE_CHALLENGES.grab;
  if (stageId.startsWith('last-')) return ROUTE_CHALLENGES.last;
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
      label: `Route challenge: ${routeChallenge(input.stageId)}`,
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
