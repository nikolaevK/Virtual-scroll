import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_OVERSCAN = 3;
const DEFAULT_SCROLLING_DELAY = 150;

type Key = string | number;

interface useDynamicSizeListInterface {
  itemHeight?: (index: number) => number;
  estimateItemHeight?: (index: number) => number;
  getItemKey: (index: number) => Key;
  itemsCount: number;
  overScan?: number;
  scrollDelay?: number;
  getScrollElement: () => HTMLElement | null;
}

interface DynamicSizeListItem {
  key: Key;
  index: number;
  offsetTop: number;
  height: number;
}

function validateProps(props: useDynamicSizeListInterface) {
  // User must provide one of these properties
  const { itemHeight, estimateItemHeight } = props;

  if (!itemHeight && !estimateItemHeight) {
    throw new Error(
      "User must provide one of these properties: itemHeight OR estimateItemHeight property"
    );
  }
}

// Has to do with Concurrent Rendering Model
// Update our ref with most recent value
function useLatest<T>(value: T) {
  const valueRef = useRef(value);
  useInsertionEffect(() => {
    valueRef.current = value;
  });
  return valueRef;
}

export function useDynamicSizeList(props: useDynamicSizeListInterface) {
  const {
    getScrollElement,
    itemHeight,
    itemsCount,
    overScan,
    scrollDelay,
    getItemKey,
    estimateItemHeight,
  } = props;
  validateProps(props);

  const [itemSizeCache, setItemSizeCache] = useState<Record<Key, number>>({});
  const [listHeight, setListHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrolling, setScrolling] = useState(false);

  // Calculates dynamic container height/listHeight based on user css property assigned to the container
  useLayoutEffect(() => {
    const scrollElement = getScrollElement();

    if (!scrollElement) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const height =
        entry.contentBoxSize[0]?.blockSize ??
        entry.target.getBoundingClientRect().height;

      setListHeight(height);
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
      const scrollTop = scrollElement.scrollTop;
      setScrollTop(scrollTop);
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

  const { endIndex, startIndex, virtualItems, allItems, totalHeight } =
    useMemo(() => {
      const getItemHeight = (index: number) => {
        if (itemHeight) {
          return itemHeight(index);
        }

        const key = getItemKey(index);
        if (typeof itemSizeCache[key] === "number") {
          return itemSizeCache[key];
        }

        return estimateItemHeight!(index);
      };

      const rangeStart = scrollTop; // position of a scroll on the top of the container, from the top of the items scrolled
      const rangeEnd = scrollTop + listHeight; // distance scrolled from the beginning plus size of the container to account for its size
      let totalHeight = 0;
      let startIndex = -1;
      let endIndex = -1;

      const allRows: DynamicSizeListItem[] = Array(itemsCount);

      for (let index = 0; index < itemsCount; index++) {
        const key = getItemKey(index);
        const row = {
          key,
          index,
          height: getItemHeight(index),
          offsetTop: totalHeight,
        };

        totalHeight += row.height;
        allRows[index] = row;

        // overscan is additional elements, needed when scrolling to not see white space
        // in the beginning there is no overscan due to the limits of an array
        // scroll down, there will be additional three elements until the end of the array
        // thats why Math.min is needed, to not exceed the size of the list
        if (startIndex === -1 && row.offsetTop + row.height > rangeStart) {
          startIndex = Math.max(
            0,
            index - (!!overScan ? overScan : DEFAULT_OVERSCAN)
          );
        }
        if (endIndex === -1 && row.offsetTop + row.height >= rangeEnd) {
          endIndex = Math.min(
            itemsCount - 1,
            index + (!!overScan ? overScan : DEFAULT_OVERSCAN)
          );
        }
      }

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
      itemsCount,
      listHeight,
      itemHeight,
      estimateItemHeight,
      overScan,
      itemSizeCache,
      getItemKey,
    ]);

  const latestData = useLatest({
    itemSizeCache,
    getItemKey,
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
          itemSizeCache,
          getItemKey,
          allItems,
          getScrollElement,
          scrollTop,
        } = latestData.current;

        const key = getItemKey(index);

        const height =
          entry.borderBoxSize[0].blockSize ??
          element.getBoundingClientRect().height;

        if (itemSizeCache[key] === height) {
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

        setItemSizeCache((cache) => ({
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
  const measureElement = useCallback((element: Element | null) => {
    if (!element) {
      return;
    }

    const indexAttribute = element.getAttribute("data-index") || "";
    const index = parseInt(indexAttribute, 10);

    if (Number.isNaN(index)) {
      console.error("Dynamic elements must have a valid data-index attribute");
      return;
    }

    const { itemSizeCache, getItemKey, allItems, getScrollElement, scrollTop } =
      latestData.current;

    const key = getItemKey(index);

    // Watches the resize of items and updates them
    itemsResizeObserver.observe(element);

    if (!!itemSizeCache[key]) {
      return;
    }

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

    setItemSizeCache((cache) => ({ ...cache, [key]: size.height }));
  }, []);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    scrolling,
    measureElement,
    allItems,
  };
}
