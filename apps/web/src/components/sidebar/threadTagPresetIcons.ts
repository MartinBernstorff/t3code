import {
  BookOpenIcon,
  BookmarkIcon,
  BugIcon,
  ClockIcon,
  CoffeeIcon,
  EyeIcon,
  FlagIcon,
  FlameIcon,
  ListTodoIcon,
  HeartIcon,
  InboxIcon,
  type LucideIcon,
  MoonIcon,
  RocketIcon,
  StarIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";

/** Keys are stored in settings; renaming one resets presets that use it to the default icon. */
export const THREAD_TAG_PRESET_ICONS = {
  bookmark: BookmarkIcon,
  target: TargetIcon,
  eye: EyeIcon,
  zap: ZapIcon,
  moon: MoonIcon,
  flame: FlameIcon,
  coffee: CoffeeIcon,
  bug: BugIcon,
  star: StarIcon,
  inbox: InboxIcon,
  "list-todo": ListTodoIcon,
  rocket: RocketIcon,
  clock: ClockIcon,
  flag: FlagIcon,
  heart: HeartIcon,
  "book-open": BookOpenIcon,
} satisfies Record<string, LucideIcon>;

const iconsByName = new Map<string, LucideIcon>(Object.entries(THREAD_TAG_PRESET_ICONS));

export function threadTagPresetIcon(name: string | undefined): LucideIcon {
  return (name === undefined ? undefined : iconsByName.get(name)) ?? BookmarkIcon;
}
