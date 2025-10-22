import React, { useState } from "react";
import { TimeTrialHome } from "@/components/game/TimeTrialHome";
import { TimeTrialEngine } from "@/components/game/TimeTrialEngine";
import { TimeTrialGameOverData } from "@/components/game/types/timetrial";
import { useNavigate } from "react-router-dom";

type Difficulty = "easy" | "hard";
type View = "home" | "game";

const TimeTrial: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("home");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  const handleStart = (level: number, diff: Difficulty) => {
    setCurrentLevel(level);
    setDifficulty(diff);
    setView("game");
  };

  const handleBack = () => {
    navigate("/");
  };

  const handleGameOver = (data: TimeTrialGameOverData) => {
    // TODO: Save best time, show game over screen
    console.log("Game Over:", data);
    setView("home");
  };

  return (
    <div className="w-full h-screen">
      {view === "home" && (
        <TimeTrialHome onStart={handleStart} onBack={handleBack} />
      )}
      {view === "game" && (
        <TimeTrialEngine
          level={currentLevel}
          difficulty={difficulty}
          onGameOver={handleGameOver}
          onBack={() => setView("home")}
        />
      )}
    </div>
  );
};

export default TimeTrial;
