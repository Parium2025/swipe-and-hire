import { type CollisionDetection, type UniqueIdentifier, type ClientRect } from "@dnd-kit/core";

const centerX = (rect: ClientRect) => rect.left + rect.width / 2;

/**
 * Collision detection that picks the active column purely by the pointer X-position.
 * This makes column selection stable across full-height invisible areas and gaps between columns.
 */
export function columnXCollisionDetection(columnIds: UniqueIdentifier[]): CollisionDetection {
  return ({ droppableRects, pointerCoordinates }) => {
    if (!pointerCoordinates) return [];

    const rects = columnIds
      .map((id) => ({ id, rect: droppableRects.get(id) }))
      .filter((v): v is { id: UniqueIdentifier; rect: ClientRect } => Boolean(v.rect));

    if (rects.length === 0) return [];

    rects.sort((a, b) => a.rect.left - b.rect.left);

    const x = pointerCoordinates.x;
    let chosenIndex = 0;

    for (let i = 0; i < rects.length - 1; i++) {
      const mid = (centerX(rects[i].rect) + centerX(rects[i + 1].rect)) / 2;
      if (x > mid) chosenIndex = i + 1;
      else break;
    }

    return [{ id: rects[chosenIndex].id }];
  };
}
