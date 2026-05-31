/**
 * Represents a single animation step in a 3D model animation sequence
 */
export interface AnimationStep {
  /** Animation name or identifier */
  name: string;
  /** Duration in seconds */
  duration: number;
  /** Whether to loop this animation */
  loop?: boolean;
  /** Start time offset in seconds */
  startTime?: number;
  /** Animation speed multiplier (1.0 = normal speed) */
  speed?: number;
  /** Transition time to next animation in seconds */
  transitionTime?: number;
}

/**
 * Type alias for animation sequence array
 */
export type AnimationSequence = AnimationStep[];
