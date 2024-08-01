import React, { useCallback, useRef, useState } from "react";
import { faker } from "@faker-js/faker";
import { useDynamicGrid } from "../hooks/useDynamicGrid";

const CONTAINER_HEIGHT = 600;
const gridSize = 100;

const createItems = () =>
  Array.from({ length: gridSize }, (_) => ({
    id: Math.random().toString(36).slice(2),
    columns: Array.from({ length: gridSize }, () => ({
      id: Math.random().toString(36).slice(2),
      text: faker.lorem.words({ min: 1, max: 7 }),
    })),
  }));

export default function GridDynamicColumn() {
  const [gridItems, setGridItems] = useState(createItems);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const {
    totalHeight,
    virtualItems,
    measureElementWidth,
    totalWidth,
    virtualColumns,
  } = useDynamicGrid({
    getScrollElement: useCallback(() => scrollElementRef.current, []),
    rowsCount: gridSize,
    columnsCount: gridSize,
    estimateColumnWidth: useCallback(() => 100, []),
    getColumnKey: useCallback((index) => index, []),
    rowHeight: useCallback(() => 30, []),
    getRowKey: useCallback((index) => gridItems[index]!.id, [gridItems]),
  });

  const reverseGrid = () => {
    setGridItems((items) =>
      items
        .map((item) => ({
          ...item,
          columns: item.columns.slice().reverse(),
        }))
        .reverse()
    );
  };

  // DEBUG: Compare useEffect vs useLayoutEffect
  // This artificially slows down rendering
  // let now = performance.now();
  // while (performance.now() - now < 1000) {
  //   // Do nothing for a bit...
  // }

  return (
    <div className="px-3 py-0">
      <h1>test</h1>
      <div className="mb-3">
        <button className="p-2 bg-red-300 rounded-sm" onClick={reverseGrid}>
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
        <div style={{ height: totalHeight, width: totalWidth }}>
          {virtualItems.map((virtualRow) => {
            const item = gridItems[virtualRow.index];
            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  top: 0,
                  transform: `translateY(${virtualRow.offsetTop}px)`,
                  padding: "6px 12px",
                  height: virtualRow.height,
                }}
              >
                {/* DO NOT PUT LOADING STATE HERE. 
                IT PREVENTS THE MEASUREMENT OF THE HEIGHT OF THE ELEMENT WHEN SCROLLING */}
                {/* {virtualRow.index} */}
                {virtualColumns.map((col) => {
                  const column = item.columns[col.index];
                  return (
                    <div
                      data-index={virtualRow.index}
                      data-column-index={col.index}
                      ref={measureElementWidth}
                      style={{
                        position: "absolute",
                        left: col.offsetLeft,
                        whiteSpace: "nowrap",
                      }}
                      key={col.key}
                    >
                      {column.text}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
