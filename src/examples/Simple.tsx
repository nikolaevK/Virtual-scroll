import React, { useCallback, useRef, useState } from "react";
import { useFixedSizeList } from "../hooks/useFixedSizeList";

const items = Array.from({ length: 10_000 }, (_, index) => ({
  id: Math.random().toString(36).slice(2),
  text: String(index),
}));

const CONTAINER_HEIGHT = 600;

export default function Simple() {
  const [listItems, setListItems] = useState(items);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const { totalHeight, scrolling, virtualItems } = useFixedSizeList({
    getScrollElement: useCallback(() => scrollElementRef.current, []),
    itemHeight: () => 40 + 10 * Math.random(),
    itemsCount: listItems.length,
  });

  return (
    <div className="px-3 py-0">
      <h1>List</h1>
      <div className="mb-3">
        <button
          className="p-2 bg-red-300 rounded-sm"
          onClick={() => setListItems((items) => [...items].reverse())}
        >
          reverse
        </button>
      </div>
      {/* fixed container to represent a window/range where list is displayed */}
      <div
        className={"relative overflow-auto border border-solid border-gray-300"}
        style={{
          height: CONTAINER_HEIGHT,
        }}
        ref={scrollElementRef}
      >
        {/* container which scrolls vertically for the length of the list */}
        <div style={{ height: totalHeight }}>
          {virtualItems.map((virtualItem) => {
            let item = listItems[virtualItem.index];

            return (
              <div
                key={item.id}
                className={`absolute top-0 py-1.5 px-3`}
                // offset is needed to display the item in a right place within the container
                style={{
                  transform: `translateY(${virtualItem.offsetTop}px)`,
                  height: virtualItem.height,
                }}
              >
                {scrolling ? "loading..." : item.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
