import { useEffect, useLayoutEffect, useMemo, useState } from "react";

const DEFAULT_OVERSCAN = 3;
const DEFAULT_SCROLLING_DELAY = 150;

interface useFixedSizeListInterface {
  itemHeight: (index: number) => number;
  itemsCount: number;
  overScan?: number;
  scrollDelay?: number;
  getScrollElement: () => HTMLElement | null;
}

export function useFixedSizeList({
  getScrollElement,
  itemHeight,
  itemsCount,
  overScan,
  scrollDelay,
}: useFixedSizeListInterface) {
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

  const { endIndex, startIndex, virtualItems, totalHeight, allItems } =
    useMemo(() => {
      const rangeStart = scrollTop; // position of a scroll on the top of the container, from the top of the items scrolled
      const rangeEnd = scrollTop + listHeight; // distance scrolled from the beginning plus size of the container to account for its size

      let totalHeight = 0;
      let startIndex = -1;
      let endIndex = -1;
      const allRows: { index: number; offsetTop: number; height: number }[] =
        Array(itemsCount);

      for (let index = 0; index <= itemsCount; index++) {
        const row = {
          index,
          height: itemHeight(index),
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
    }, [scrollTop, itemsCount, listHeight, itemHeight, overScan]);

  return { virtualItems, totalHeight, startIndex, endIndex, scrolling };
}
