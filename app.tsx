import { defineVaporComponent, ref } from "vue";
import { animate } from "@pocketjs/framework/vue-vapor/animation";
import {
  FocusScope,
  Image,
  Portal,
  Text,
  View,
  type NodeMirror,
} from "@pocketjs/framework/vue-vapor/components";
import {
  BTN,
  cursorX,
  cursorY,
  enableCursor,
  getFocused,
  setCursorPosition,
} from "@pocketjs/framework/vue-vapor/input";
import { analogX, analogY, onButtonPress, onFrame } from "@pocketjs/framework/vue-vapor/lifecycle";

const ICONS = {
  chat: { dark: "assets/chat-dark.png", light: "assets/chat-light.png" },
  chevron: { dark: "assets/chevron-dark.png", light: "assets/chevron-light.png" },
  close: { dark: "assets/close-dark.png", light: "assets/close-light.png" },
  eye: { dark: "assets/eye-dark.png", light: "assets/eye-light.png" },
  eyeOff: { dark: "assets/eye-off-dark.png", light: "assets/eye-off-light.png" },
  mic: { dark: "assets/mic-dark.png", light: "assets/mic-light.png" },
  micOff: { dark: "assets/mic-off-dark.png", light: "assets/mic-off-light.png" },
  moon: { dark: "assets/moon-dark.png", light: "assets/moon-light.png" },
  move: { dark: "assets/move-dark.png", light: "assets/move-light.png" },
  pin: { dark: "assets/pin-dark.png", light: "assets/pin-light.png" },
  pinOff: { dark: "assets/pin-off-dark.png", light: "assets/pin-off-light.png" },
  profile: { dark: "assets/profile-dark.png", light: "assets/profile-light.png" },
  refresh: { dark: "assets/refresh-dark.png", light: "assets/refresh-light.png" },
  settings: { dark: "assets/settings-dark.png", light: "assets/settings-light.png" },
  sun: { dark: "assets/sun-dark.png", light: "assets/sun-light.png" },
  target: { dark: "assets/target-dark.png", light: "assets/target-light.png" },
} as const;

type IconName = keyof typeof ICONS;

enum AuthState {
  LoggedOut,
  SigningIn,
  Authenticated,
}

enum DrawerState {
  Collapsed,
  Entering,
  Expanded,
  Leaving,
}

enum HostPanel {
  None,
  Settings,
  Chat,
  Account,
  Close,
}

function valueOf<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function callbackOf(value: unknown): () => void {
  if (typeof value !== "function") return () => {};
  return () => {
    const result = (value as () => unknown)();
    if (typeof result === "function") result();
  };
}

function drawerEasing(progress: number): number {
  const sample = (time: number, point1: number, point2: number) => {
    const inverse = 1 - time;
    return 3 * inverse * inverse * time * point1
      + 3 * inverse * time * time * point2
      + time * time * time;
  };

  let low = 0;
  let high = 1;
  let time = progress;
  for (let iteration = 0; iteration < 10; iteration++) {
    const x = sample(time, 0.32, 0);
    if (Math.abs(x - progress) < 0.0001) break;
    if (x < progress) low = time;
    else high = time;
    time = (low + high) / 2;
  }
  return sample(time, 0.72, 1);
}

function cursorInsideControls(drawerVisible: boolean): boolean {
  const x = cursorX();
  const y = cursorY();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const insideRail = x >= 432 && x < 472 && y >= 136 && y < 264;
  const insideDrawer = drawerVisible && x >= 270 && x < 424 && y >= 64 && y < 264;
  return insideRail || insideDrawer;
}

function cursorOverStage(position: number): boolean {
  const x = cursorX();
  const y = cursorY();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const centerX = 198 + position * 48;
  const radius = 56;
  if (x < centerX - radius || x > centerX + radius || y < 66 || y > 270) return false;
  if (y >= 122 && y <= 214) return true;

  const centerY = y < 122 ? 122 : 214;
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

interface ControlButtonProps {
  active?: boolean;
  danger?: boolean;
  dark: boolean;
  icon: IconName;
  iconScale?: number;
  label: string;
  onActivate: () => void;
  tooltipSide?: "left" | "top";
}

const ControlButton = defineVaporComponent((_props: ControlButtonProps, { attrs }) => {
  const active = () => valueOf(attrs.active as boolean | (() => boolean) | undefined) ?? false;
  const dark = () => valueOf(attrs.dark as boolean | (() => boolean));
  const danger = () => valueOf(attrs.danger as boolean | (() => boolean) | undefined) ?? false;
  const icon = () => valueOf(attrs.icon as IconName | (() => IconName));
  const iconScale = () => valueOf(attrs.iconScale as number | (() => number) | undefined) ?? 1;
  const label = () => valueOf(attrs.label as string | (() => string));
  const side = () => valueOf(attrs.tooltipSide as "left" | "top" | (() => "left" | "top") | undefined) ?? "top";
  const activate = () => callbackOf(attrs.onActivate);
  const focused = ref(false);
  let buttonNode: NodeMirror | undefined;

  onFrame(() => {
    const nextFocused = getFocused() === buttonNode;
    if (focused.value === nextFocused) return;
    focused.value = nextFocused;
  });

  const buttonClass = () => {
    if (active()) {
      return dark()
        ? "w-10 h-10 items-center justify-center rounded-xl shadow-md bg-[#262626b3] border-[#67e8f9b3] focus:bg-[#404040e6] focus:border-cyan-200 active:bg-[#404040] transition-colors duration-150"
        : "w-10 h-10 items-center justify-center rounded-xl shadow-md bg-[#fafafacc] border-[#0891b2b3] focus:bg-[#e5e5e5e6] focus:border-cyan-700 active:bg-[#d4d4d4] transition-colors duration-150";
    }
    if (danger()) {
      return dark()
        ? "w-10 h-10 items-center justify-center rounded-xl shadow bg-[#262626b3] border-[#2626261a] focus:bg-[#4c0519e6] focus:border-rose-400 active:bg-rose-900 transition-colors duration-150"
        : "w-10 h-10 items-center justify-center rounded-xl shadow bg-[#fafafacc] border-[#e5e5e599] focus:bg-[#ffe4e6e6] focus:border-rose-500 active:bg-rose-200 transition-colors duration-150";
    }
    return dark()
      ? "w-10 h-10 items-center justify-center rounded-xl shadow bg-[#262626b3] border-[#2626261a] focus:bg-[#404040e6] focus:border-[#d4d4d4] active:bg-[#404040] transition-colors duration-150"
      : "w-10 h-10 items-center justify-center rounded-xl shadow bg-[#fafafacc] border-[#e5e5e599] focus:bg-[#e5e5e5e6] focus:border-[#737373] active:bg-[#d4d4d4] transition-colors duration-150";
  };

  return (
    <View class="relative w-10 h-10">
      <View
        nodeRef={(node: NodeMirror | null) => {
          buttonNode = node ?? undefined;
        }}
        class={buttonClass()}
        focusable
        onPress={activate()}
      >
        <Image
          class="w-5 h-5"
          src={dark() ? ICONS[icon()].dark : ICONS[icon()].light}
          style={{ scale: iconScale() }}
        />
      </View>
      {focused.value ? (
        <View
          class={dark()
            ? "absolute z-20 px-1.5 py-1 rounded-lg shadow bg-slate-800 border-slate-700"
            : "absolute z-20 px-1.5 py-1 rounded-lg shadow bg-white border-slate-200"}
          style={side() === "left"
            ? { insetR: 44, insetT: 8 }
            : { insetR: 0, insetB: 44 }}
        >
          <Text class={dark() ? "text-xs text-slate-200" : "text-xs text-slate-700"}>{label()}</Text>
        </View>
      ) : null}
    </View>
  );
});

interface OverlayProps {
  dark: boolean;
  onClose: () => void;
}

const HostPanelOverlay = defineVaporComponent((_props: OverlayProps & { panel: HostPanel }, { attrs }) => {
  const dark = () => valueOf(attrs.dark as boolean | (() => boolean));
  const panel = () => valueOf(attrs.panel as HostPanel | (() => HostPanel));
  const close = () => callbackOf(attrs.onClose);

  const title = () => {
    if (panel() === HostPanel.Settings) return "Settings";
    if (panel() === HostPanel.Chat) return "Chat";
    if (panel() === HostPanel.Account) return "AIRI account";
    return "Close requested";
  };

  const description = () => {
    if (panel() === HostPanel.Settings) return "Pocket host settings surface";
    if (panel() === HostPanel.Chat) return "Pocket host chat surface";
    if (panel() === HostPanel.Account) return "Portable account and Flux surface";
    return "The portable host intercepted the desktop close action";
  };

  return (
    <Portal>
      <FocusScope class="absolute inset-0 z-50 items-center justify-center" active autoFocus restoreFocus>
        <View class={dark()
          ? "w-[244] flex-col gap-3 p-4 rounded-xl shadow-lg bg-slate-900 border-slate-700"
          : "w-[244] flex-col gap-3 p-4 rounded-xl shadow-lg bg-white border-slate-200"}
        >
          <Text class={dark() ? "text-lg text-slate-100 font-bold" : "text-lg text-slate-900 font-bold"}>
            {title()}
          </Text>
          <Text class={dark() ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
            {description()}
          </Text>
          <View
            class={dark()
              ? "px-3 py-2 rounded-lg bg-slate-800 border-slate-700 focus:bg-slate-700 focus:border-cyan-400 transition-colors duration-150"
              : "px-3 py-2 rounded-lg bg-slate-100 border-slate-200 focus:bg-cyan-100 focus:border-cyan-600 transition-colors duration-150"}
            focusable
            onPress={close()}
          >
            <Text class={dark() ? "text-sm text-slate-100 font-bold" : "text-sm text-slate-800 font-bold"}>Done</Text>
          </View>
        </View>
      </FocusScope>
    </Portal>
  );
});

const ProfileOverlay = defineVaporComponent((_props: OverlayProps & {
  activeProfile: number;
  onManage: () => void;
  onSelect: (index: number) => void;
}, { attrs }) => {
  const activeProfile = () => valueOf(attrs.activeProfile as number | (() => number));
  const dark = () => valueOf(attrs.dark as boolean | (() => boolean));
  const close = () => callbackOf(attrs.onClose);
  const manage = () => callbackOf(attrs.onManage);
  const select = (index: number) => {
    const callback = attrs.onSelect as ((index: number) => void) | (() => (index: number) => void);
    const result = callback(index);
    if (typeof result === "function") result(index);
  };

  return (
    <Portal>
      <FocusScope class="absolute inset-0 z-50 items-center justify-center" active autoFocus restoreFocus>
        <View class={dark()
          ? "w-[224] flex-col gap-2 p-3 rounded-xl shadow-lg bg-slate-900 border-slate-700"
          : "w-[224] flex-col gap-2 p-3 rounded-xl shadow-lg bg-white border-slate-200"}
        >
          <Text class={dark() ? "text-sm text-slate-100 font-bold" : "text-sm text-slate-900 font-bold"}>Switch profile</Text>
          {["Airi", "Assistant"].map((name, index) => (
            <View
              class={activeProfile() === index
                ? dark()
                  ? "flex-row items-center gap-2 px-2 py-2 rounded-lg bg-cyan-950 border-cyan-500 focus:bg-cyan-900 focus:border-cyan-200 transition-colors duration-150"
                  : "flex-row items-center gap-2 px-2 py-2 rounded-lg bg-cyan-100 border-cyan-500 focus:bg-cyan-200 focus:border-cyan-700 transition-colors duration-150"
                : dark()
                  ? "flex-row items-center gap-2 px-2 py-2 rounded-lg bg-slate-800 border-slate-700 focus:bg-slate-700 focus:border-slate-300 transition-colors duration-150"
                  : "flex-row items-center gap-2 px-2 py-2 rounded-lg bg-slate-100 border-slate-200 focus:bg-slate-200 focus:border-slate-500 transition-colors duration-150"}
              focusable
              onPress={() => select(index)}
            >
              <View class={index === 0 ? "w-4 h-4 rounded-full bg-cyan-400" : "w-4 h-4 rounded-full bg-violet-400"} />
              <Text class={dark() ? "text-xs text-slate-200" : "text-xs text-slate-800"}>{name}</Text>
            </View>
          ))}
          <View
            class={dark()
              ? "px-2 py-2 rounded-lg bg-slate-800 border-slate-700 focus:bg-slate-700 focus:border-cyan-400"
              : "px-2 py-2 rounded-lg bg-slate-100 border-slate-200 focus:bg-slate-200 focus:border-cyan-600"}
            focusable
            onPress={manage()}
          >
            <Text class={dark() ? "text-xs text-slate-300" : "text-xs text-slate-700"}>Manage profiles</Text>
          </View>
        </View>
      </FocusScope>
    </Portal>
  );
});

const HearingOverlay = defineVaporComponent((_props: OverlayProps & {
  autoSendEnabled: boolean;
  microphoneEnabled: boolean;
  onToggleAutoSend: () => void;
  onToggleMicrophone: () => void;
  volume: number;
}, { attrs }) => {
  const autoSendEnabled = () => valueOf(attrs.autoSendEnabled as boolean | (() => boolean));
  const dark = () => valueOf(attrs.dark as boolean | (() => boolean));
  const microphoneEnabled = () => valueOf(attrs.microphoneEnabled as boolean | (() => boolean));
  const volume = () => valueOf(attrs.volume as number | (() => number));
  const close = () => callbackOf(attrs.onClose);
  const toggleAutoSend = () => callbackOf(attrs.onToggleAutoSend);
  const toggleMicrophone = () => callbackOf(attrs.onToggleMicrophone);

  return (
    <Portal>
      <FocusScope class="absolute inset-0 z-50 items-center justify-center" active autoFocus restoreFocus>
        <View class={dark()
          ? "w-[260] flex-col gap-2 p-3 rounded-xl shadow-lg bg-slate-900 border-slate-700"
          : "w-[260] flex-col gap-2 p-3 rounded-xl shadow-lg bg-white border-slate-200"}
        >
          <View class="flex-row items-center justify-between">
            <View class="flex-col">
              <Text class={dark() ? "text-sm text-slate-100 font-bold" : "text-sm text-slate-900 font-bold"}>Hearing</Text>
              <Text class={dark() ? "text-xs text-slate-400" : "text-xs text-slate-500"}>Microphone controls</Text>
            </View>
            <View class="flex-row items-end gap-1 h-8">
              {[0.42, 0.7, 1, 0.56].map((factor) => (
                <View
                  class={microphoneEnabled() ? "w-1 rounded-xl bg-cyan-400" : "w-1 rounded-xl bg-slate-500"}
                  style={{ height: microphoneEnabled() ? 6 + volume() * 20 * factor : 4 }}
                />
              ))}
            </View>
          </View>
          <View
            class={dark()
              ? "flex-row items-center justify-between px-2 py-2 rounded-lg bg-slate-800 border-slate-700 focus:bg-slate-700 focus:border-cyan-400 transition-colors duration-150"
              : "flex-row items-center justify-between px-2 py-2 rounded-lg bg-slate-100 border-slate-200 focus:bg-slate-200 focus:border-cyan-600 transition-colors duration-150"}
            focusable
            onPress={toggleMicrophone()}
          >
            <Text class={dark() ? "text-xs text-slate-200" : "text-xs text-slate-800"}>Microphone</Text>
            <Text class={microphoneEnabled() ? "text-xs text-cyan-500 font-bold" : "text-xs text-slate-500 font-bold"}>
              {microphoneEnabled() ? "ON" : "OFF"}
            </Text>
          </View>
          <View
            class={dark()
              ? "flex-row items-center justify-between px-2 py-2 rounded-lg bg-slate-800 border-slate-700 focus:bg-slate-700 focus:border-cyan-400 transition-colors duration-150"
              : "flex-row items-center justify-between px-2 py-2 rounded-lg bg-slate-100 border-slate-200 focus:bg-slate-200 focus:border-cyan-600 transition-colors duration-150"}
            focusable
            onPress={toggleAutoSend()}
          >
            <Text class={dark() ? "text-xs text-slate-200" : "text-xs text-slate-800"}>Auto send</Text>
            <Text class={autoSendEnabled() ? "text-xs text-cyan-500 font-bold" : "text-xs text-slate-500 font-bold"}>
              {autoSendEnabled() ? "ON" : "OFF"}
            </Text>
          </View>
          <View
            class={dark()
              ? "px-2 py-2 rounded-lg bg-slate-800 border-slate-700 focus:bg-slate-700 focus:border-slate-300"
              : "px-2 py-2 rounded-lg bg-slate-100 border-slate-200 focus:bg-slate-200 focus:border-slate-500"}
            focusable
            onPress={close()}
          >
            <Text class={dark() ? "text-xs text-slate-300" : "text-xs text-slate-700"}>Close</Text>
          </View>
        </View>
      </FocusScope>
    </Portal>
  );
});

export default function ControlIsland() {
  const activeProfile = ref(0);
  const authState = ref(AuthState.LoggedOut);
  const authFrames = ref(0);
  const autoSendEnabled = ref(false);
  const alwaysOnTop = ref(true);
  const cursorModeEnabled = ref(false);
  const darkMode = ref(true);
  const drawerProgress = ref(0);
  const drawerState = ref(DrawerState.Collapsed);
  const fadeOnHoverEnabled = ref(false);
  const stageAuraOpacity = ref(0.28);
  const stageCharacterOpacity = ref(0.72);
  const stageHovered = ref(false);
  const hearingOpen = ref(false);
  const hostPanel = ref(HostPanel.None);
  const microphoneEnabled = ref(false);
  const profileOpen = ref(false);
  const stagePosition = ref(0);
  const volume = ref(0);
  const arrowFocused = ref(false);
  let arrowButtonNode: NodeMirror | undefined;
  let chevronNode: NodeMirror | undefined;
  let stageAuraNode: NodeMirror | undefined;
  let stageCharacterNode: NodeMirror | undefined;
  let drawerLinearProgress = 0;
  let outsideFrames = 0;
  let pointerLeavePending = false;
  let stageFadeProgress = 0;
  let stopCursorMode: (() => void) | undefined;
  let volumeFrame = 0;

  const overlaysOpen = () => profileOpen.value || hearingOpen.value || hostPanel.value !== HostPanel.None;
  const drawerVisible = () => drawerState.value !== DrawerState.Collapsed;

  function finishCollapse(): void {
    drawerState.value = DrawerState.Collapsed;
    profileOpen.value = false;
    hearingOpen.value = false;
    hostPanel.value = HostPanel.None;
  }

  function collapse(): void {
    if (overlaysOpen()) {
      profileOpen.value = false;
      hearingOpen.value = false;
      hostPanel.value = HostPanel.None;
      return;
    }
    if (drawerState.value === DrawerState.Collapsed || drawerState.value === DrawerState.Leaving) return;
    drawerState.value = DrawerState.Leaving;
    if (chevronNode) animate(chevronNode, "rotate", 0, { dur: 300, easing: "in-out" });
  }

  function expand(): void {
    if (drawerState.value === DrawerState.Collapsed) {
      drawerLinearProgress = 0;
      drawerProgress.value = 0;
    }
    drawerState.value = DrawerState.Entering;
    if (chevronNode) animate(chevronNode, "rotate", 180, { dur: 300, easing: "in-out" });
  }

  function toggleDrawer(): void {
    if (drawerState.value === DrawerState.Collapsed || drawerState.value === DrawerState.Leaving) {
      expand();
      return;
    }
    collapse();
  }

  function beginAuthentication(): void {
    if (authState.value === AuthState.Authenticated) {
      hostPanel.value = HostPanel.Account;
      return;
    }
    if (authState.value === AuthState.SigningIn) return;
    authState.value = AuthState.SigningIn;
    authFrames.value = 48;
  }

  function resetStage(): void {
    stopCursor();
    activeProfile.value = 0;
    authFrames.value = 0;
    authState.value = AuthState.LoggedOut;
    autoSendEnabled.value = false;
    alwaysOnTop.value = true;
    darkMode.value = true;
    drawerLinearProgress = 0;
    drawerProgress.value = 0;
    drawerState.value = DrawerState.Collapsed;
    profileOpen.value = false;
    hearingOpen.value = false;
    hostPanel.value = HostPanel.None;
    microphoneEnabled.value = false;
    fadeOnHoverEnabled.value = false;
    stageAuraOpacity.value = 0.28;
    stageCharacterOpacity.value = 0.72;
    stageFadeProgress = 0;
    stageHovered.value = false;
    moveStage(0);
  }

  function moveStage(position: number): void {
    stagePosition.value = position;
    const translateX = position * 48;
    if (stageAuraNode) animate(stageAuraNode, "translateX", translateX, { dur: 300, easing: "out-back" });
    if (stageCharacterNode) animate(stageCharacterNode, "translateX", translateX, { dur: 300, easing: "out-back" });
  }

  function cycleStagePosition(): void {
    if (stagePosition.value >= 1) {
      moveStage(-1);
      return;
    }
    moveStage(stagePosition.value + 1);
  }

  function startCursorMode(x?: number, y?: number): void {
    if (!cursorModeEnabled.value) {
      stopCursorMode = enableCursor({ speed: 240 });
      cursorModeEnabled.value = true;
      pointerLeavePending = false;
      outsideFrames = 0;
    }
    if (x !== undefined && y !== undefined) setCursorPosition(x, y);
  }

  function stopCursor(scheduleOutsideCollapse = false): void {
    stopCursorMode?.();
    stopCursorMode = undefined;
    cursorModeEnabled.value = false;
    stageHovered.value = false;
    pointerLeavePending = scheduleOutsideCollapse;
    outsideFrames = scheduleOutsideCollapse ? 1 : 0;
  }

  globalThis.__pocketPointerMove = (x: number, y: number) => { startCursorMode(x, y); };
  globalThis.__pocketPointerLeave = () => { stopCursor(true); };

  onButtonPress(BTN.TRIANGLE, collapse, { allowWhenBlocked: true });
  onButtonPress(BTN.UP | BTN.RIGHT | BTN.DOWN | BTN.LEFT, () => { stopCursor(); }, { allowWhenBlocked: true });
  onFrame(() => {
    if (!cursorModeEnabled.value && (Math.abs(analogX()) > 0.12 || Math.abs(analogY()) > 0.12)) startCursorMode();

    const focused = getFocused();
    const nextArrowFocused = focused === arrowButtonNode;
    if (arrowFocused.value !== nextArrowFocused) arrowFocused.value = nextArrowFocused;

    const nextStageHovered = cursorModeEnabled.value && cursorOverStage(stagePosition.value);
    if (stageHovered.value !== nextStageHovered) stageHovered.value = nextStageHovered;

    const fadeTarget = fadeOnHoverEnabled.value && nextStageHovered ? 1 : 0;
    if (stageFadeProgress < fadeTarget) stageFadeProgress = Math.min(fadeTarget, stageFadeProgress + 1 / 15);
    else if (stageFadeProgress > fadeTarget) stageFadeProgress = Math.max(fadeTarget, stageFadeProgress - 1 / 15);
    const fadeInverse = 1 - stageFadeProgress;
    const fadeEased = 1 - fadeInverse * fadeInverse * fadeInverse;
    const visibleAuraOpacity = darkMode.value ? 0.28 : 0.62;
    stageAuraOpacity.value = visibleAuraOpacity + (0.05 - visibleAuraOpacity) * fadeEased;
    stageCharacterOpacity.value = 0.72 * (1 - fadeEased);

    if (overlaysOpen() || drawerState.value === DrawerState.Collapsed || cursorInsideControls(drawerVisible())) {
      outsideFrames = 0;
      pointerLeavePending = false;
    }
    else if (cursorModeEnabled.value || pointerLeavePending) {
      outsideFrames++;
      if (outsideFrames >= 90) {
        pointerLeavePending = false;
        collapse();
      }
    }

    if (drawerState.value === DrawerState.Entering) {
      drawerLinearProgress = Math.min(1, drawerLinearProgress + 1 / 30);
      drawerProgress.value = drawerEasing(drawerLinearProgress);
      if (drawerLinearProgress >= 1) drawerState.value = DrawerState.Expanded;
    }
    else if (drawerState.value === DrawerState.Leaving) {
      drawerLinearProgress = Math.max(0, drawerLinearProgress - 1 / 24);
      drawerProgress.value = drawerEasing(drawerLinearProgress);
      if (drawerLinearProgress <= 0) finishCollapse();
    }

    if (authFrames.value > 0) {
      authFrames.value--;
      if (authFrames.value === 0) authState.value = AuthState.Authenticated;
    }

    volumeFrame++;
    if (volumeFrame % 4 !== 0) return;
    volume.value = microphoneEnabled.value ? (Math.sin(volumeFrame * 0.12) + 1) / 2 : 0;
  });

  return (
    <View class={darkMode.value
      ? "relative w-full h-full overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900"
      : "relative w-full h-full overflow-hidden bg-gradient-to-b from-slate-100 to-slate-300"}
    >
      <View
        nodeRef={(node: NodeMirror | null) => { stageAuraNode = node ?? undefined; }}
        class={darkMode.value
          ? "absolute left-[86] top-[24] w-[224] h-[224] rounded-full bg-cyan-950"
          : "absolute left-[86] top-[24] w-[224] h-[224] rounded-full bg-cyan-100"}
        style={{ opacity: stageAuraOpacity.value }}
      />
      <View
        nodeRef={(node: NodeMirror | null) => { stageCharacterNode = node ?? undefined; }}
        class={darkMode.value
          ? "absolute left-[142] top-[66] w-[112] h-[204] rounded-full bg-slate-700"
          : "absolute left-[142] top-[66] w-[112] h-[204] rounded-full bg-slate-400"}
        style={{ opacity: stageCharacterOpacity.value }}
      />
      <View class={darkMode.value
        ? "absolute left-0 top-[190] w-full h-[1] bg-slate-700 opacity-50"
        : "absolute left-0 top-[190] w-full h-[1] bg-slate-400 opacity-50"}
      />

      {hostPanel.value !== HostPanel.None ? (
        <HostPanelOverlay dark={darkMode.value} panel={hostPanel.value} onClose={() => { hostPanel.value = HostPanel.None; }} />
      ) : null}
      {profileOpen.value ? (
        <ProfileOverlay
          activeProfile={activeProfile.value}
          dark={darkMode.value}
          onClose={() => { profileOpen.value = false; }}
          onManage={() => {
            profileOpen.value = false;
            hostPanel.value = HostPanel.Settings;
          }}
          onSelect={(index: number) => {
            activeProfile.value = index;
            profileOpen.value = false;
          }}
        />
      ) : null}
      {hearingOpen.value ? (
        <HearingOverlay
          autoSendEnabled={autoSendEnabled.value}
          dark={darkMode.value}
          microphoneEnabled={microphoneEnabled.value}
          onClose={() => { hearingOpen.value = false; }}
          onToggleAutoSend={() => { autoSendEnabled.value = !autoSendEnabled.value; }}
          onToggleMicrophone={() => { microphoneEnabled.value = !microphoneEnabled.value; }}
          volume={volume.value}
        />
      ) : null}

      {drawerVisible() ? (
        <View
          class={darkMode.value
            ? "absolute right-[56] bottom-2 z-10 w-[154] flex-col gap-1 p-2 rounded-xl shadow-lg bg-[#171717cc] border-[#262626ff]"
            : "absolute right-[56] bottom-2 z-10 w-[154] flex-col gap-1 p-2 rounded-xl shadow-lg bg-[#f5f5f5cc] border-[#e5e5e5ff]"}
          style={{
            opacity: drawerProgress.value,
            translateY: (1 - drawerProgress.value) * 32,
            scaleX: 0.9 + drawerProgress.value * 0.1,
            scaleY: 0.9 + drawerProgress.value * 0.1,
          }}
        >
          <View class={darkMode.value
            ? "absolute left-2 right-2 top-1 h-[1] rounded-[1] bg-[#ffffff2e]"
            : "absolute left-2 right-2 top-1 h-[1] rounded-[1] bg-[#ffffffb8]"}
          />
          <View
            class={darkMode.value
              ? "w-[136] h-[44] flex-row items-center gap-2 px-2 py-1 rounded-xl bg-[#26262600] border-[#2626261a] focus:bg-[#40404099] focus:border-cyan-400 transition-colors duration-150"
              : "w-[136] h-[44] flex-row items-center gap-2 px-2 py-1 rounded-xl bg-[#fafafa00] border-[#e5e5e566] focus:bg-[#e5e5e599] focus:border-cyan-600 transition-colors duration-150"}
            focusable
            onPress={beginAuthentication}
          >
            <View class={authState.value === AuthState.Authenticated
              ? "w-8 h-8 rounded-full bg-cyan-400"
              : authState.value === AuthState.SigningIn
                ? "w-5 h-5 rounded-full bg-cyan-500 animate-pulse"
                : "w-5 h-5 rounded-full bg-slate-500"}
            />
            <View class="flex-col grow">
              <Text class={darkMode.value ? "text-xs text-slate-100 font-bold" : "text-xs text-slate-900 font-bold"}>
                {authState.value === AuthState.Authenticated
                  ? "Airi"
                  : authState.value === AuthState.SigningIn
                    ? "Signing in..."
                    : "Sign in"}
              </Text>
              <Text class={authState.value === AuthState.Authenticated
                ? "text-xs text-cyan-500 font-bold"
                : darkMode.value ? "text-xs text-slate-500" : "text-xs text-slate-500"}
              >
                {authState.value === AuthState.Authenticated ? "120 Flux" : "AIRI account"}
              </Text>
            </View>
          </View>

          <View class="w-[136] flex-row flex-wrap gap-2">
            <ControlButton dark={darkMode.value} icon="settings" label="Open settings" onActivate={() => { hostPanel.value = HostPanel.Settings; }} />
            <ControlButton dark={darkMode.value} icon="profile" label="Switch profile" onActivate={() => { profileOpen.value = true; }} />
            <ControlButton dark={darkMode.value} icon="chat" label="Open chat" onActivate={() => { hostPanel.value = HostPanel.Chat; }} />
            <ControlButton dark={darkMode.value} icon="refresh" label="Refresh" onActivate={resetStage} />
            <ControlButton dark={darkMode.value} icon="target" label="Center stage" onActivate={() => { moveStage(0); }} />
            <ControlButton dark={darkMode.value} icon={darkMode.value ? "moon" : "sun"} label={darkMode.value ? "Switch to light mode" : "Switch to dark mode"} onActivate={() => { darkMode.value = !darkMode.value; }} />
            <ControlButton dark={darkMode.value} icon={alwaysOnTop.value ? "pin" : "pinOff"} label={alwaysOnTop.value ? "Unpin from top" : "Pin on top"} onActivate={() => { alwaysOnTop.value = !alwaysOnTop.value; }} />
            <ControlButton dark={darkMode.value} icon={fadeOnHoverEnabled.value ? "eye" : "eyeOff"} label={fadeOnHoverEnabled.value ? "Disable hover fade" : "Enable hover fade"} active={fadeOnHoverEnabled.value} onActivate={() => { fadeOnHoverEnabled.value = !fadeOnHoverEnabled.value; }} />
            <ControlButton dark={darkMode.value} icon="close" label="Close" danger onActivate={() => { hostPanel.value = HostPanel.Close; }} />
          </View>
        </View>
      ) : null}

      <View class="absolute right-2 bottom-2 z-10 flex-col gap-1">
        <View class="relative w-10 h-10">
          <View
            nodeRef={(node: NodeMirror | null) => { arrowButtonNode = node ?? undefined; }}
            class={darkMode.value
              ? "w-10 h-10 items-center justify-center rounded-xl shadow bg-[#262626b3] border-[#2626261a] focus:bg-[#404040e6] focus:border-[#d4d4d4] active:bg-[#404040] transition-colors duration-150"
              : "w-10 h-10 items-center justify-center rounded-xl shadow bg-[#fafafacc] border-[#e5e5e599] focus:bg-[#e5e5e5e6] focus:border-[#737373] active:bg-[#d4d4d4] transition-colors duration-150"}
            focusable
            onPress={toggleDrawer}
          >
            <Image
              nodeRef={(node: NodeMirror | null) => { chevronNode = node ?? undefined; }}
              class="w-5 h-5"
              src={darkMode.value ? ICONS.chevron.dark : ICONS.chevron.light}
            />
          </View>
          {arrowFocused.value ? (
            <View
              class={darkMode.value
                ? "absolute z-20 px-1.5 py-1 rounded-lg shadow bg-slate-800 border-slate-700"
                : "absolute z-20 px-1.5 py-1 rounded-lg shadow bg-white border-slate-200"}
              style={{ insetR: 44, insetT: 8 }}
            >
              <Text class={darkMode.value ? "text-xs text-slate-200" : "text-xs text-slate-700"}>
                {drawerState.value === DrawerState.Collapsed ? "Expand" : "Collapse"}
              </Text>
            </View>
          ) : null}
        </View>
        <ControlButton
          dark={darkMode.value}
          icon={microphoneEnabled.value ? "mic" : "micOff"}
          iconScale={microphoneEnabled.value ? 1 + volume.value * 0.08 : 1}
          label="Open hearing controls"
          onActivate={() => { hearingOpen.value = true; }}
          tooltipSide="left"
        />
        <ControlButton dark={darkMode.value} icon="move" label="Move window" onActivate={cycleStagePosition} tooltipSide="left" />
      </View>
    </View>
  );
}
