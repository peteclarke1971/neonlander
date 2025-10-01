export interface SurvivalGameOverData {
  cause: "crash" | "fuel";
  distance: number; // Distance traveled
  time: number; // Survival time in seconds
  score: number; // Total score
  landings: number; // Number of successful landings
}
