import React, { useCallback, useRef, useState } from "react";
import { useFixedSizeList } from "../hooks/useFixedSizeList";

const items = Array.from({ length: 10_000 }, (_, index) => ({
  id: Math.random().toString(36).slice(2),
  text: String(index),
}));

const ITEM_HEIGHT = 40;
const CONTAINER_HEIGHT = 600;

export default function Simple() {
  const [listItems, setListItems] = useState(items);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const { TOTAL_LIST_HEIGHT, scrolling, virtualItems } = useFixedSizeList({
    getScrollElement: useCallback(() => scrollElementRef.current, []),
    itemHeight: ITEM_HEIGHT,
    listHeight: 600,
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
          height: `${CONTAINER_HEIGHT}px`,
        }}
        ref={scrollElementRef}
      >
        {/* container which scrolls vertically for the length of the list */}
        <div
          style={{
            height: TOTAL_LIST_HEIGHT,
          }}
        >
          {virtualItems.map((virtualItem) => {
            let item = listItems[virtualItem.index];

            return (
              <div
                key={item.id}
                className={`absolute top-0 h-[${ITEM_HEIGHT}px] py-1.5 px-3`}
                // offset is needed to display the item in a right place within the container
                style={{
                  transform: `translateY(${virtualItem.offsetTop}px)`,
                  height: `${ITEM_HEIGHT}`,
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
