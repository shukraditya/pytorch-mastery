export interface ProblemSummary {
  id: string;
  title: string;
  week: number;
  day: number;
  difficulty: string;
  focus: string;
  prerequisites: string[];
  lines_estimate: number;
  time_estimate: string;
  tier: "core" | "depth";
}

export interface Example {
  name: string;
  inputs: Record<string, string>;
  expected: Record<string, any>;
}

export interface Problem {
  id: string;
  title: string;
  week: number;
  day: number;
  difficulty: string;
  focus: string;
  prerequisites: string[];
  lines_estimate: number;
  time_estimate: string;
  tier: "core" | "depth";
  description: string;
  starter_code: string;
  function_name: string;
  test_cases?: {
    visible: Example[];
  };
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
