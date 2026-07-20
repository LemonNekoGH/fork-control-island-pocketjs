export {};

declare global {
  /** Runtime global installed by PocketJS before Vue Vapor schedules work. */
  function queueMicrotask(callback: () => void): void;

  var __pocketPointerMove: ((x: number, y: number) => void) | undefined;
  var __pocketPointerLeave: (() => void) | undefined;
}
