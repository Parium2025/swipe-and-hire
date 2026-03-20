export const KANBAN_BOARD_VIEWPORT_STYLE = {
  height: 'calc(100vh - 300px)',
  overflowY: 'hidden' as const,
};

export const TOUCH_TARGET_44_STYLE = {
  height: '44px',
  minHeight: '44px',
  padding: '0 1rem',
} as const;

type StageResolverItem = { id: string };

export const resolveDropStage = <T extends StageResolverItem>(
  overRawId: string | undefined,
  stages: string[],
  items: T[],
  getItemStage: (item: T) => string
): string | null => {
  if (!overRawId) return null;
  if (stages.includes(overRawId)) return overRawId;

  const overItem = items.find((item) => item.id === overRawId);
  if (!overItem) return null;

  const stage = getItemStage(overItem);
  return stages.includes(stage) ? stage : null;
};

export const resetDragState = (
  setActiveId: (value: string | null) => void,
  setOverId: (value: string | null) => void
) => {
  setActiveId(null);
  setOverId(null);
};