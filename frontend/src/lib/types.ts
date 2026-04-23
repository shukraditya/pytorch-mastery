export interface ProblemSummary {
  id: string;
  title: string;
  week: number;
  day: number;
  difficulty: string;
  focus: string;
}

export interface Problem {
  id: string;
  title: string;
  week: number;
  day: number;
  difficulty: string;
  focus: string;
  description: string;
  starter_code: string;
  function_name: string;
}

export interface TestCaseResult {
  name: string;
  passed: boolean;
  actual: string | null;
  expected: string | null;
  error: string | null;
}

export interface RunResponse {
  passed: boolean;
  results: TestCaseResult[];
}
