// Rotating level intro names system
// Each level type has a roster of names that cycle in order

import { Mode } from '../types';
import { isWaterLevel, isLightningLevel, isCollectionLevel } from './levelConfig';
import { getMedleyLevelType } from './medleyConfig';

export type IntroLevelType = 'normal' | 'timetrial' | 'darkside' | 'search' | 'storm' | 'underwater' | 'collection' | null;

// Name rosters for each level type
const NORMAL_NAMES = [
  "JUST LAND!",
  "PUT IT DOWN, PILOT",
  "EASY DOESN'T MEAN EASY",
  "STANDARD PROCEDURE… RIGHT?",
  "BRING HER HOME",
  "COME ON, YOU KNOW THIS ONE",
  "STICK THE LANDING",
  "GRAVITY IS WATCHING",
  "PLEASE DON'T CRASH",
  "IT'S JUST A PAD — RELAX"
];

const TIME_TRIAL_NAMES = [
  "LAND, LAND AGAIN",
  "MOVE IT, ROOKIE!",
  "CLOCK'S TICKING",
  "FASTER! FASTER!",
  "RUSH JOB",
  "NO TIME TO THINK",
  "FULL THRUST AHEAD",
  "STOP WASTING SECONDS",
  "TIME IS FUEL",
  "LAND NOW, EXPLAIN LATER"
];

const DARK_SIDE_NAMES = [
  "DARK SIDE",
  "WELCOME TO THE DARK SIDE",
  "OH GREAT… NO LIGHT",
  "YOU'RE FLYING BLIND",
  "ABSOLUTELY ZERO VISIBILITY",
  "BETTER HOPE THAT LIGHT WORKS",
  "GOOD LUCK SEEING ANYTHING",
  "YOU WON'T LIKE THIS PLACE"
];

const SEARCH_NAMES = [
  "SEARCH IN PROGRESS",
  "DON'T BLINK",
  "HOLD STILL, WE'RE LOOKING",
  "INITIATING SURVEY BEAM",
  "TERRAIN… SOMEWHERE…",
  "THE LIGHT WILL FIND IT",
  "EYES ON THE PRIZE"
];

const STORM_NAMES = [
  "THERE'S A STORM COMING",
  "BRACE YOURSELF PILOT",
  "WEATHER'S GONE TO HELL",
  "IONIC CHAOS INBOUND",
  "KABOOM!!!",
  "FRIGHTENING LIGHTNING"
];

const COLLECTION_NAMES = [
  "SPACE JUNK RETRIEVAL",
  "CLEAN UP THIS ORBIT",
  "FIND THE SCRAP, PILOT",
  "NO LANDING UNTIL IT'S CLEAN",
  "BRING BACK THE GOODS",
  "NO JUNK, NO LANDING"
];

const UNDERWATER_NAMES = [
  "DIVE! DIVE! DIVE!",
  "THE DEEP CALLS",
  "THIS ISN'T A SUBMARINE",
  "JOLLY JELLIES",
  "SPLASHDOWN ZONE",
  "IN TOO DEEP",
  "WHO PUT WATER HERE",
  "INTO THE ABYSS"
];

// Map level types to their rosters
const ROSTERS: Record<Exclude<IntroLevelType, null>, string[]> = {
  normal: NORMAL_NAMES,
  timetrial: TIME_TRIAL_NAMES,
  darkside: DARK_SIDE_NAMES,
  search: SEARCH_NAMES,
  storm: STORM_NAMES,
  underwater: UNDERWATER_NAMES,
  collection: COLLECTION_NAMES
};

/**
 * Determines the intro level type based on mode and level configuration
 */
export function getIntroLevelType(mode: Mode, level: number): IntroLevelType {
  // Check medley mode first - uses its own level type system
  if (mode === "medley") {
    const medleyType = getMedleyLevelType(level);
    
    // Map medley types to intro types
    const typeMap: Record<string, IntroLevelType> = {
      'normal': 'normal',
      'timetrial': 'timetrial',
      'darkside': 'darkside',
      'storm': 'storm',
      'collection': 'collection',
      'search': 'search',
      'underwater': 'underwater'
    };
    
    return typeMap[medleyType] || 'normal';
  }
  
  // Check time trial
  if (mode === "timetrial") return 'timetrial';
  
  // Check blackout/lightbeam levels (classic and fixed modes)
  if ((mode === "classic" || mode === "fixed") && level % 10 === 9 && level >= 9) return 'darkside';
  if ((mode === "classic" || mode === "fixed") && level % 10 === 4 && level >= 14) return 'search';
  
  // Check config-based types
  if (isLightningLevel(mode, level)) return 'storm';
  if (isWaterLevel(mode, level)) return 'underwater';
  if (isCollectionLevel(mode, level)) return 'collection';
  
  // Default for classic/fixed modes (normal landing levels)
  if (mode === "classic" || mode === "fixed") return 'normal';
  
  // Caverns mode doesn't show intro names
  return null;
}

/**
 * Gets the next name from the roster for a given level type
 * Cycles through the roster and persists the index in localStorage
 */
export function getNextIntroName(levelType: Exclude<IntroLevelType, null>): string {
  const storageKey = `intro_index_${levelType}`;
  const roster = ROSTERS[levelType];
  
  // Get current index from localStorage
  let currentIndex = parseInt(localStorage.getItem(storageKey) || '0', 10);
  
  // Get the name at current index
  const name = roster[currentIndex % roster.length];
  
  // Advance to next index and save
  const nextIndex = (currentIndex + 1) % roster.length;
  localStorage.setItem(storageKey, String(nextIndex));
  
  return name;
}
