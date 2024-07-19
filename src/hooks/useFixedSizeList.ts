import { useEffect, useLayoutEffect, useMemo, useState } from "react";

const DEFAULT_OVERSCAN = 3;
const DEFAULT_SCROLLING_DELAY = 150;

interface useFixedSizeListInterface {
  itemHeight: number;
  itemsCount: number;
  listHeight: number;
  overScan?: number;
  scrollDelay?: number;
  getScrollElement: () => HTMLElement | null;
}

export function useFixedSizeList({
  getScrollElement,
  itemHeight,
  itemsCount,
  listHeight,
  overScan,
  scrollDelay,
}: useFixedSizeListInterface) {
  const [scrollTop, setScrollTop] = useState(0);
  const [scrolling, setScrolling] = useState(false);

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

    let timeoutId: NodeJS.Timeout | null = null;

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

  const { endIndex, startIndex, virtualItems } = useMemo(() => {
    const rangeStart = scrollTop; // position of a scroll on the top of the container, from the top of the items scrolled
    const rangeEnd = scrollTop + listHeight; // distance scrolled from the beginning plus size of the container to account for its size

    // Find and calculate the beginning position where elements range should start
    // Find and calculate the end position where elements range should end
    let startIndex = Math.floor(rangeStart / itemHeight);
    let endIndex = Math.ceil(rangeEnd / itemHeight);

    // Accounting for potential negative number when startIndex 0
    startIndex = Math.max(
      0,
      startIndex - (!!overScan ? overScan : DEFAULT_OVERSCAN)
    );
    endIndex = Math.min(
      itemsCount - 1,
      endIndex + (!!overScan ? overScan : DEFAULT_OVERSCAN)
    );

    let virtualItems: { index: number; offsetTop: number }[] = [];

    for (let index = startIndex; index <= endIndex; index++) {
      virtualItems.push({
        index,
        offsetTop: index * itemHeight,
      });
    }

    return { virtualItems, startIndex, endIndex };
  }, [scrollTop, itemsCount, listHeight]);

  const TOTAL_LIST_HEIGHT = itemsCount * itemHeight;

  return { virtualItems, TOTAL_LIST_HEIGHT, startIndex, endIndex, scrolling };
}
