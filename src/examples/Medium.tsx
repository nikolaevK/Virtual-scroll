import React, { useCallback, useRef, useState } from "react";
import { faker } from "@faker-js/faker";
import { useDynamicSizeList } from "../hooks/useDynamicSizeList";

const items = Array.from({ length: 10_000 }, (_, index) => ({
  id: Math.random().toString(36).slice(2),
  text: faker.lorem.paragraphs({
    min: 3,
    max: 6,
  }),
}));

const CONTAINER_HEIGHT = 600;

export default function Medium() {
  const [listItems, setListItems] = useState(items);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const { totalHeight, scrolling, virtualItems, measureElement } =
    useDynamicSizeList({
      getScrollElement: useCallback(() => scrollElementRef.current, []),
      // itemHeight: () => 40 + 10 * Math.random(), Optional Parameter
      itemsCount: listItems.length,
      estimateItemHeight: useCallback(() => 16, []),
      getItemKey: useCallback((index) => listItems[index]!.id, [listItems]),
    });

  return (
    <div className="px-3 py-0">
      <h1>test</h1>
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
        ref={scrollElementRef}
        style={{
          height: CONTAINER_HEIGHT,
          overflow: "auto",
          border: "1px solid lightgrey",
          position: "relative",
        }}
      >
        {/* container which scrolls vertically for the length of the list */}
        <div style={{ height: totalHeight }}>
          {virtualItems.map((virtualItem) => {
            let item = listItems[virtualItem.index];
            return (
              <div
                key={item.id}
                ref={measureElement}
                // this attribute is used in the useDynamicSizeList hook to differentiate items from one another
                data-index={virtualItem.index}
                // offset is needed to display the item in a right place within the container
                style={{
                  position: "absolute",
                  top: 0,
                  transform: `translateY(${virtualItem.offsetTop}px)`,
                  padding: "6px 12px",
                  //   border: "1px solid lightgrey",
                  //   height: virtualItem.height,
                }}
              >
                {scrolling
                  ? "loading..."
                  : `${virtualItem.index} - ${item.text}`}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
