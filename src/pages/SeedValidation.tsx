import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  validateAllTimeTrialSeeds, 
  generateValidatedConfig,
  SeedValidationResult 
} from "@/components/game/systems/timeTrialSeedValidator";
import { ArrowLeft, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SeedValidation() {
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SeedValidationResult[]>([]);
  const [validatedConfig, setValidatedConfig] = useState<string>("");

  const runValidation = () => {
    setIsValidating(true);
    setProgress(0);
    setResults([]);
    setValidatedConfig("");

    // Run validation with progress updates
    const validationResults = validateAllTimeTrialSeeds((current, total) => {
      setProgress((current / total) * 100);
    });

    setResults(validationResults);
    setValidatedConfig(generateValidatedConfig(validationResults));
    setIsValidating(false);
  };

  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.filter(r => !r.isValid).length;
  const replacedCount = results.filter(r => r.validatedSeed && r.validatedSeed !== r.seed).length;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">Time Trial Seed Validator</h1>
            <p className="text-muted-foreground mt-2">
              Validate all 50 Time Trial level seeds to ensure correct pad generation
            </p>
          </div>
        </div>

        {/* Run Validation Button */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Run Validation</h2>
              <p className="text-sm text-muted-foreground">
                This will test all 50 seeds and find replacements for invalid ones
              </p>
            </div>
            <Button
              onClick={runValidation}
              disabled={isValidating}
              size="lg"
              className="gap-2"
            >
              <PlayCircle className="h-5 w-5" />
              {isValidating ? "Validating..." : "Start Validation"}
            </Button>
          </div>

          {isValidating && (
            <div className="mt-6">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {Math.round(progress)}% complete
              </p>
            </div>
          )}
        </Card>

        {/* Results Summary */}
        {results.length > 0 && (
          <>
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Validation Summary</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">{validCount}</div>
                  <div className="text-sm text-muted-foreground">Valid Seeds</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-500">{replacedCount}</div>
                  <div className="text-sm text-muted-foreground">Replaced Seeds</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-500">{invalidCount}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            </Card>

            {/* Detailed Results */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Detailed Results</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result) => (
                  <div
                    key={result.level}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.isValid
                        ? "bg-green-500/10 border border-green-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {result.isValid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-semibold">Level {result.level}</div>
                        <div className="text-sm text-muted-foreground">
                          Seed: {result.seed}
                          {result.validatedSeed && result.validatedSeed !== result.seed && (
                            <span className="text-yellow-500 ml-2">
                              (replaced, +{result.attempts} attempts)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm">
                      {result.isValid ? (
                        <span className="text-green-500">
                          {result.actualPads}/{result.expectedPads} pads ✓
                        </span>
                      ) : (
                        <span className="text-red-500">
                          {result.actualPads}/{result.expectedPads} pads ✗
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Generated Config */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Updated Configuration</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Copy this configuration to replace TIME_TRIAL_LEVELS in timeTrialLevels.ts
              </p>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                {validatedConfig}
              </pre>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(validatedConfig);
                }}
                variant="outline"
                className="mt-4"
              >
                Copy to Clipboard
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
