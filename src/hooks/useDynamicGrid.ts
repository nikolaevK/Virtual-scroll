import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_OVERSCAN_Y = 3;
const DEFAULT_OVERSCAN_X = 1;
const DEFAULT_SCROLLING_DELAY = 150;

type Key = string | number;

interface useDynamicGridInterface {
  rowHeight?: (index: number) => number;
  estimateRowHeight?: (index: number) => number;
  getRowKey: (index: number) => Key;
  columnsCount: number;
  columnWidth?: (index: number) => number;
  estimateColumnWidth?: (index: number) => number;
  getColumnKey: (index: number) => Key;
  rowsCount: number;
  overScanY?: number;
  overScanX?: number;
  scrollDelay?: number;
  getScrollElement: () => HTMLElement | null;
}

interface DynamicSizeGridRow {
  key: Key;
  index: number;
  offsetTop: number;
  height: number;
}
interface DynamicSizeGridColumn {
  key: Key;
  index: number;
  offsetLeft: number;
  width: number;
}

function validateProps(props: useDynamicGridInterface) {
  // User must provide one of these properties
  const { rowHeight, estimateRowHeight, estimateColumnWidth, columnWidth } =
    props;

  if (!rowHeight && !estimateRowHeight) {
    throw new Error(
      "User must provide one of these properties: rowHeight OR estimateRowHeight property"
    );
  }
  if (!columnWidth && !estimateColumnWidth) {
    throw new Error(
      "User must provide one of these properties: columnWidth OR estimateColumnWidth property"
    );
  }

  // One of these must be static
  if (!rowHeight && !columnWidth) {
    throw new Error(
      "User must provide one of these properties: rowHeight OR columnWidth property"
    );
  }
}

// Has to do with Concurrent Rendering Model
// Update ref with most recent value
function useLatest<T>(value: T) {
  const valueRef = useRef(value);
  useInsertionEffect(() => {
    valueRef.current = value;
  });
  return valueRef;
}

export function useDynamicGrid(props: useDynamicGridInterface) {
  validateProps(props);

  const {
    getScrollElement,
    rowHeight,
    rowsCount,
    columnsCount,
    columnWidth,
    overScanY,
    overScanX,
    scrollDelay,
    getRowKey,
    getColumnKey,
    estimateRowHeight,
    estimateColumnWidth,
  } = props;

  const [rowSizeCache, setRowSizeCache] = useState<Record<Key, number>>({});
  const [columnSizeCache, setColumnSizeCache] = useState<
    Record<string, number>
  >({});
  const [gridHeight, setGridHeight] = useState(0);
  const [gridWidth, setGridWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrolling, setScrolling] = useState(false);

  // Calculate a list of column widths
  const calculatedColumnWidths = useMemo(() => {
    if (columnWidth) {
      return Array.from({ length: columnsCount }, (_, index) =>
        columnWidth(index)
      );
    }

    const widths: number[] = Array(columnsCount);

    // Max column width
    for (let columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
      let maxMeasuredColumnWidth: number | undefined = undefined;

      for (let rowIndex = 0; rowIndex < rowsCount; rowIndex++) {
        const key = `${getRowKey(rowIndex)}-${getColumnKey(columnIndex)}`;
        const columnSize = columnSizeCache[key];

        if (typeof columnSize === "number") {
          maxMeasuredColumnWidth = !!maxMeasuredColumnWidth
            ? Math.max(maxMeasuredColumnWidth, columnSize)
            : columnSize;
        }

        if (typeof maxMeasuredColumnWidth === "number") {
          widths[columnIndex] = maxMeasuredColumnWidth;
        } else {
          widths[columnIndex] = estimateColumnWidth?.(columnIndex) ?? 0;
        }
      }
    }
    return widths;
  }, [
    columnSizeCache,
    columnsCount,
    rowsCount,
    getRowKey,
    getColumnKey,
    columnWidth,
    estimateColumnWidth,
  ]);

  // Calculates dynamic container height/listHeight and Width based on user css property assigned to the container
  useLayoutEffect(() => {
    // DEBUG:
    console.log("Container height calculation...");

    const scrollElement = getScrollElement();

    if (!scrollElement) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const size = entry.contentBoxSize[0]
        ? {
            height: entry.contentBoxSize[0].blockSize,
            width: entry.contentBoxSize[0].inlineSize,
          }
        : entry.target.getBoundingClientRect();

      setGridHeight(size.height);
      setGridWidth(size.width);
    });

    resizeObserver.observe(scrollElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [getScrollElement]);

  useLayoutEffect(() => {
    const scrollElement = getScrollElement();
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollLeft } = scrollElement;
      setScrollTop(scrollTop);
      setScrollLeft(scrollLeft);
    };

    handleScroll();

    scrollElement.addEventListener("scroll", handleScroll);

    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [getScrollElement]);

  // Show loading indicator when user scrolls, in order to not load extra data/content
  // or for example if images are loading
  useEffect(() => {
    const scrollElement = getScrollElement();

    if (!scrollElement) return;

    let timeoutId: number | null = null;

    const handleScrollingLoadIndicator = () => {
      setScrolling(true);

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(
        () => {
          setScrolling(false);
        },
        !!scrollDelay ? scrollDelay : DEFAULT_SCROLLING_DELAY
      );
    };

    scrollElement.addEventListener("scroll", handleScrollingLoadIndicator);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      scrollElement.removeEventListener("scroll", handleScrollingLoadIndicator);
    };
  }, [getScrollElement]);

  // Rows in the window algorithm
  const { virtualItems, startIndex, endIndex, allItems, totalHeight } =
    useMemo(() => {
      // DEBUG:
      console.log("useMemo calculate range algorithm");

      const getRowHeight = (index: number) => {
        if (rowHeight) {
          return rowHeight(index);
        }

        const key = getRowKey(index);
        if (typeof rowSizeCache[key] === "number") {
          // DEBUG:
          console.log("Cache inside range algorithm hit");
          return rowSizeCache[key];
        }

        return estimateRowHeight!(index);
      };

      const rangeStart = scrollTop; // position of a scroll on the top of the container, from the top of the items scrolled
      const rangeEnd = scrollTop + gridHeight; // distance scrolled from the beginning plus size of the container to account for its size
      let totalHeight = 0;
      let startIndex = -1;
      let endIndex = -1;

      // DEBUG:
      // To see how algorithm uses it to calculate range
      console.log({ gridHeight });

      const allRows: DynamicSizeGridRow[] = Array(rowsCount);

      for (let index = 0; index < rowsCount; index++) {
        const key = getRowKey(index);
        const row = {
          key,
          index,
          height: getRowHeight(index),
          offsetTop: totalHeight,
        };

        totalHeight += row.height;
        allRows[index] = row;

        if (startIndex === -1 && row.offsetTop + row.height > rangeStart) {
          startIndex = Math.max(
            0,
            index - (!!overScanY ? overScanY : DEFAULT_OVERSCAN_Y)
          );
        }
        if (endIndex === -1 && row.offsetTop + row.height >= rangeEnd) {
          endIndex = Math.min(
            rowsCount - 1,
            index + (!!overScanY ? overScanY : DEFAULT_OVERSCAN_Y)
          );
        }
      }
      // DEBUG:
      console.log("New range based on new measurements:", {
        startIndex,
        endIndex,
      });

      const virtualItems = allRows.slice(startIndex, endIndex + 1);

      return {
        virtualItems,
        startIndex,
        endIndex,
        allItems: allRows,
        totalHeight,
      };
    }, [
      scrollTop,
      rowsCount,
      rowHeight,
      gridHeight,
      estimateRowHeight,
      overScanY,
      rowSizeCache,
      getRowKey,
    ]);

  // Columns in the window algorithm
  const {
    virtualColumns,
    columnStartIndex,
    columnEndIndex,
    allColumns,
    totalWidth,
  } = useMemo(() => {
    const rangeStart = scrollLeft;
    const rangeEnd = scrollLeft + gridWidth;
    let totalWidth = 0;
    let columnStartIndex = -1;
    let columnEndIndex = -1;

    const allColumns: DynamicSizeGridColumn[] = Array(columnsCount);

    for (let index = 0; index < columnsCount; index++) {
      const key = getColumnKey(index);
      const column = {
        key,
        index,
        width: calculatedColumnWidths[index],
        offsetLeft: totalWidth,
      };

      totalWidth += column.width;
      allColumns[index] = column;

      if (
        columnStartIndex === -1 &&
        column.offsetLeft + column.width > rangeStart
      ) {
        columnStartIndex = Math.max(
          0,
          index - (!!overScanX ? overScanX : DEFAULT_OVERSCAN_X)
        );
      }
      if (
        columnEndIndex === -1 &&
        column.offsetLeft + column.width >= rangeEnd
      ) {
        columnEndIndex = Math.min(
          rowsCount - 1,
          index + (!!overScanX ? overScanX : DEFAULT_OVERSCAN_X)
        );
      }
    }
    // DEBUG:
    console.log("New range based on new measurements:", {
      columnStartIndex,
      columnEndIndex,
    });

    const virtualColumns = allColumns.slice(
      columnStartIndex,
      columnEndIndex + 1
    );

    return {
      virtualColumns,
      columnStartIndex,
      columnEndIndex,
      allColumns,
      totalWidth,
    };
  }, [
    scrollLeft,
    columnsCount,
    calculatedColumnWidths,
    gridWidth,
    overScanX,
    getColumnKey,
  ]);

  const latestData = useLatest({
    columnSizeCache,
    allColumns,
    scrollLeft,
    getColumnKey,
    rowSizeCache,
    getRowKey,
    allItems,
    getScrollElement,
    scrollTop,
  });

  // Goes on every item in virtualScroll
  const itemsResizeObserver = useMemo(() => {
    const ro = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const element = entry.target;

        if (!element.isConnected) {
          ro.unobserve(element);
          return;
        }

        const indexAttribute = element.getAttribute("data-index") || "";
        const index = parseInt(indexAttribute, 10);

        if (Number.isNaN(index)) {
          console.error(
            "Dynamic elements must have a valid data-index attribute"
          );
          return;
        }

        const {
          rowSizeCache,
          getRowKey,
          allItems,
          getScrollElement,
          scrollTop,
        } = latestData.current;

        const key = getRowKey(index);

        const height =
          entry.borderBoxSize[0].blockSize ??
          element.getBoundingClientRect().height;

        if (rowSizeCache[key] === height) {
          return;
        }

        // Correction scroll. Fixes The issue of scroll adjustment/scroll height
        const item = allItems[index];
        const delta = height - item.height;

        if (delta !== 0 && scrollTop > item.offsetTop) {
          const element = getScrollElement();
          if (element) {
            element.scrollBy(0, delta);
          }
        }

        setRowSizeCache((cache) => ({
          ...cache,
          [key]: height,
        }));
      });
    });
    return ro;
  }, [latestData]);

  // Get height of the element and write it into cache
  // The RefCallback function is going to run after the component is mounted, re-rendered or unmounted.
  // Use the useCallback function with an empty dependency array to wrap the callback ref function.
  // this will make sure that React runtime will run this function only on mount and that is it.
  const measureElementHeight = useCallback((element: Element | null) => {
    // DEBUG:
    console.log("Inside measureElement RefCallback");

    if (!element) {
      // DEBUG:
      console.log("Extra elements which are not in DOM");
      return;
    }

    const indexAttribute = element.getAttribute("data-index") || "";
    const index = parseInt(indexAttribute, 10);

    if (Number.isNaN(index)) {
      console.error("Dynamic elements must have a valid data-index attribute");
      return;
    }

    const { rowSizeCache, getRowKey, allItems, getScrollElement, scrollTop } =
      latestData.current;

    const key = getRowKey(index);

    // Watches the resize of items and updates them
    itemsResizeObserver.observe(element);

    if (!!rowSizeCache[key]) {
      // DEBUG:
      console.log("Hit cache return when tried to measure measured element");
      return;
    }
    // DEBUG:
    // Elements which are not in cache and fired measureElement
    console.log("Element which needs height measurement", { index });

    const size = element.getBoundingClientRect();

    // Correction scroll. Fixes The issue of scroll adjustment/scroll height
    const item = allItems[index];
    const delta = size.height - allItems[index].height;

    if (delta !== 0 && scrollTop > item.offsetTop) {
      const element = getScrollElement();
      if (element) {
        element.scrollBy(0, delta);
      }
    }

    setRowSizeCache((cache) => ({ ...cache, [key]: size.height }));
  }, []);

  const measureColumnWidth = useCallback(
    (
      element: Element | null,
      resizeObserver: ResizeObserver,
      entry?: ResizeObserverEntry
    ) => {
      if (!element) {
        return;
      }

      if (!element.isConnected) {
        resizeObserver.unobserve(element);
        return;
      }

      const rowIndexAttribute = element.getAttribute("data-index") || "";
      const rowIndex = parseInt(rowIndexAttribute, 10);

      const columnIndexAttribute =
        element.getAttribute("data-column-index") || "";
      const columnIndex = parseInt(columnIndexAttribute, 10);

      if (Number.isNaN(rowIndex) || Number.isNaN(columnIndex)) {
        console.error(
          "dynamic rows must have valid `data-column-index` and `data-index` (row) attributes"
        );
        return;
      }

      const {
        columnSizeCache,
        getRowKey,
        getColumnKey,
        allColumns,
        scrollLeft,
      } = latestData.current;

      const key = `${getRowKey(rowIndex)}-${getColumnKey(columnIndex)}`;
      const isResize = Boolean(entry);

      resizeObserver.observe(element);

      // Optimization, save a rerender
      // no resize and element is measured
      if (!isResize && typeof columnSizeCache[key] === "number") {
        return;
      }

      const width =
        entry?.borderBoxSize[0]?.inlineSize ??
        element.getBoundingClientRect().width;

      if (columnSizeCache[key] === width) {
        return;
      }

      setColumnSizeCache((cache) => ({ ...cache, [key]: width }));

      const column = allColumns[columnIndex];
      const delta = width - column.width;

      if (delta !== 0 && scrollLeft > column.offsetLeft) {
        const element = getScrollElement();
        if (element) {
          element.scrollBy(delta, 0);
          console.log(delta);
        }
      }
    },
    [latestData]
  );

  const columnWidthResizeObserver = useMemo(() => {
    const ro = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        measureColumnWidth(entry.target, ro, entry);
      });
    });
    return ro;
  }, []);

  const measureElementWidth = useCallback(
    (element: Element | null) => {
      measureColumnWidth(element, columnWidthResizeObserver);
    },
    [columnWidthResizeObserver]
  );

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    scrolling,
    measureElementHeight,
    measureElementWidth,
    allItems,
    virtualColumns,
    columnStartIndex,
    columnEndIndex,
    allColumns,
    totalWidth,
  };
}
